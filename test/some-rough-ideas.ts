import { viem } from "hardhat";
import { Artifact } from "hardhat/types";
import { Account, Address, getAccount } from "viem";

import { A } from "../artifacts/contracts/A.sol";

describe("Example test with viem", function () {
  it("Should infer the contract type", async function () {
    const a = await deployContract(A);

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
      args: ["hello"],
    }); // s has its proper type
  });
});

async function getAccounts(): Promise<Account[]> {
  const addresses = await viem.walletClient.getAddresses(); // Maybe cache this?
  return Promise.all(addresses.map(getAccount));
}

async function deployContract<
  ArtifactT extends Artifact /* TODO: Infer the readonly type here */
>(artifact: ArtifactT, args = [], deployerAddres?: Address) {
  const { viem } = await import("hardhat");

  const deployer =
    deployerAddres ?? (await viem.walletClient.getAddresses())[0];
  const deployerAccount = await getAccount(deployer);

  const deploymentTx = await viem.walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode, // TODO: this is a string, not `0x...`
    args,
    account: deployerAccount,
  });

  const deploymentReceipt = await viem.publicClient.getTransactionReceipt({
    hash: deploymentTx,
  });

  return deploymentReceipt.contractAddress!;
}
