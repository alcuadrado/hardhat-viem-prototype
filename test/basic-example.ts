import { viem, artifacts } from "hardhat";
import { getAccount } from "viem";

// There are three ways of importing artifacts to work well with viem:
// import { A } from "../artifacts/contracts/A.sol";
// const A = await hre.artifacts.readArtifact("A");
// const A = hre.artifacts.readArtifactSync("A");

describe("Example test with viem", function () {
  it("Should infer every type correctly", async function () {
    const A = await artifacts.readArtifact("A");

    const [deployer] = await viem.walletClient.getAddresses();
    const deployerAccount = await getAccount(deployer);

    const deploymentTx = await viem.walletClient.deployContract({
      ...A, // Shorthand syntax instead of using A.abi and A.bytecode
      account: deployerAccount,
    });

    const deploymentReceipt = await viem.publicClient.getTransactionReceipt({
      hash: deploymentTx,
    });
    const a = deploymentReceipt.contractAddress!;

    const tx = await viem.walletClient.writeContract({
      address: a,
      ...A,
      functionName: "writeANumber",
      args: [1n],
      account: deployerAccount,
    });

    const s = await viem.publicClient.readContract({
      address: a,
      ...A,
      functionName: "returnsString",
      args: ["hello"],
    });

    console.log({ s });
  });

  it("Should support repeated contract names", async function () {
    // const Repetated = await artifacts.readArtifact("Repeated"); // Type: never

    // These work
    const RepetatedA = await artifacts.readArtifact("contracts/A.sol:Repeated");
    const RepetatedB = await artifacts.readArtifact("contracts/B.sol:Repeated");
  });
});
