// scripts/verify-sourcify.cjs
// Verifies deployed contract on Sourcify using deployment.json
// Run: node scripts/verify-sourcify.cjs

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.join(__dirname, "..");
const DEPLOYMENT_PATH = path.join(PROJECT_ROOT, "deployment.json");
const CONTRACT_NAME = "BreevsRussianRoulette";

function runCurl(args) {
    const output = execFileSync("curl", args, { encoding: "utf8" });
    try {
        return JSON.parse(output);
    } catch {
        return output;
    }
}

function findContractDbgPath(rootDir, contractName) {
    const stack = [rootDir];
    while (stack.length) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (entry.name === `${contractName}.dbg.json`) {
                return fullPath;
            }
        }
    }
    return null;
}

function loadMetadataAndSource(contractName) {
    const artifactsContracts = path.join(PROJECT_ROOT, "artifacts", "contracts");
    if (!fs.existsSync(artifactsContracts)) {
        throw new Error('Artifacts folder missing. Run "npm run compile" first.');
    }

    const dbgPath = findContractDbgPath(artifactsContracts, contractName);
    if (!dbgPath) {
        throw new Error(
            `Could not locate ${contractName}.dbg.json in artifacts/contracts.`
        );
    }

    const dbgJson = JSON.parse(fs.readFileSync(dbgPath, "utf8"));
    const buildInfoPath = path.resolve(path.dirname(dbgPath), dbgJson.buildInfo);
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));

    let sourceName = null;
    let metadataString = null;
    for (const [candidateSource, contractsByName] of Object.entries(
        buildInfo.output.contracts
    )) {
        const found = contractsByName[contractName];
        if (found?.metadata) {
            sourceName = candidateSource;
            metadataString = found.metadata;
            break;
        }
    }

    if (!sourceName || !metadataString) {
        throw new Error(`Could not resolve metadata for ${contractName}.`);
    }

    const sourcePath = path.join(PROJECT_ROOT, sourceName);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file missing at ${sourcePath}`);
    }

    return {
        sourceName,
        sourcePath,
        metadataString,
    };
}

function checkAlreadyVerified(chainId, contractAddress) {
    const result = runCurl([
        "--http1.1",
        "-sS",
        "--max-time",
        "20",
        `https://sourcify.dev/server/v2/contract/${chainId}/${contractAddress}?fields=all`,
    ]);
    return (
        typeof result === "object" &&
        result !== null &&
        (Boolean(result.matchId) ||
            Boolean(result.creationMatch) ||
            Boolean(result.runtimeMatch))
    );
}

function verifyWithSourcify(chainId, contractAddress, metadataPath, sourcePath, sourceName) {
    return runCurl([
        "--http1.1",
        "-sS",
        "--max-time",
        "45",
        "-X",
        "POST",
        "https://sourcify.dev/server/",
        "-F",
        `address=${contractAddress}`,
        "-F",
        `chain=${chainId}`,
        "-F",
        `files=@${metadataPath};filename=metadata.json`,
        "-F",
        `files=@${sourcePath};filename=${sourceName}`,
    ]);
}

function ensureDeploymentFile() {
    if (!fs.existsSync(DEPLOYMENT_PATH)) {
        throw new Error(
            `deployment.json not found at ${DEPLOYMENT_PATH}. Deploy first to generate it.`
        );
    }
    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
    if (!deployment.contractAddress || !deployment.chainId) {
        throw new Error("deployment.json must contain contractAddress and chainId.");
    }
    return deployment;
}

async function verify() {
    const deployment = ensureDeploymentFile();
    // UUPS: verify implementation bytecode (logic contract), not the proxy shell
    const CONTRACT_ADDRESS =
        deployment.implementationAddress || deployment.contractAddress;
    const PROXY_ADDRESS = deployment.proxyAddress || deployment.contractAddress;
    const CHAIN_ID = String(deployment.chainId);

    console.log("================================================");
    console.log("  Breevs Russian Roulette - Sourcify Verify    ");
    console.log("================================================");
    if (deployment.implementationAddress) {
        console.log("Proxy (app)  :", PROXY_ADDRESS);
    }
    console.log("Verifying    :", CONTRACT_ADDRESS);
    console.log("Chain ID :", CHAIN_ID);
    console.log("Network  :", deployment.network || "unknown");
    console.log("------------------------------------------------");

    console.log("Checking if already verified on Sourcify...");
    if (checkAlreadyVerified(CHAIN_ID, CONTRACT_ADDRESS)) {
        console.log("Already verified!");
        console.log(`View: https://repo.sourcify.dev/${CHAIN_ID}/${CONTRACT_ADDRESS}`);
        console.log("================================================");
        return;
    }
    console.log("Not yet verified - proceeding...");

    const { sourceName, sourcePath, metadataString } = loadMetadataAndSource(CONTRACT_NAME);
    const tmpMetadataPath = path.join(
        os.tmpdir(),
        `breevs-metadata-${Date.now()}.json`
    );
    fs.writeFileSync(tmpMetadataPath, metadataString);

    console.log("Submitting to Sourcify...");
    const result = verifyWithSourcify(
        CHAIN_ID,
        CONTRACT_ADDRESS,
        tmpMetadataPath,
        sourcePath,
        sourceName
    );
    fs.unlinkSync(tmpMetadataPath);

    console.log("------------------------------------------------");
    const status = result?.result?.[0]?.status;
    if (status === "perfect" || status === "partial") {
        console.log(`Verification successful! Match: ${status}`);
        console.log(`Sourcify  : https://repo.sourcify.dev/${CHAIN_ID}/${CONTRACT_ADDRESS}`);
        return;
    }

    console.error("Verification failed. Response from Sourcify:");
    console.error(JSON.stringify(result, null, 2));
    console.error("\nTry manual verification at: https://sourcify.dev/#/verifier");
    process.exit(1);
}

verify().catch((err) => {
    console.error("Unexpected error:", err.message);
    process.exit(1);
});
