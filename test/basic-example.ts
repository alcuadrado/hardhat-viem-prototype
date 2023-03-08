import { viem } from "hardhat";
import { getAccount } from "viem";

import { A } from "../artifacts/contracts/A.sol";

describe("Example test with viem", function () {
  it("Should infer the contract type", async function () {
    const [deployer] = await viem.walletClient.getAddresses();
    const deployerAccount = await getAccount(deployer); // Not clear why i need to import this directly and it's not available in the client

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
      functionName: "writeANumber", // Proper type here
      args: [1n], // Proper type here
      account: deployerAccount,
    });

    // Having to switch between clients can be confusing
    const s = await viem.publicClient.readContract({
      address: a,
      ...A,
      functionName: "returnsString", // Proper type here
      args: ["hello"], // <----------------------------------------------- This one works
    }); // s has its proper type


    
    const s2 = await viem.publicClient.readContract({
      address: a,
      ...A,
      functionName: "returnsString", // Proper type here
      args: [], // <----------------------------------------------- This one doesn't
    });

    console.log({s, s2})
  });
});
