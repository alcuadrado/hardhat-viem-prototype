import { viem, artifacts } from "hardhat";
import { getAccount } from "viem";

// This still works
// import { A } from "../artifacts/contracts/A.sol";

describe("Example test with viem", function () {
  it("Should infer the contract type", async function () {
    const A = await artifacts.readArtifact("A");

    const [deployer] = await viem.walletClient.getAddresses();
    const deployerAccount = await getAccount(deployer);

    const deploymentTx = await viem.walletClient.deployContract({
      ...A,
      account: deployerAccount,
    });

    // This is pretty verbose, maybe a helper?
    const deploymentReceipt = await viem.publicClient.getTransactionReceipt({
      hash: deploymentTx,
    });
    const a = deploymentReceipt.contractAddress!;

    const tx = await viem.walletClient.writeContract({
      address: a,
      ...A,
      functionName: "writeANumber",
      args: [1n], // Proper type here
      account: deployerAccount,
    });

    // Having to switch between clients can be confusing
    const s = await viem.publicClient.readContract({
      address: a,
      ...A,
      functionName: "returnsString", // Proper type here
      args: ["hello"], // Proper type here
    }); // s has its proper type

    console.log({ s });
  });
});
