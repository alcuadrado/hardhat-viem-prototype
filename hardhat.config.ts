import { extendEnvironment, HardhatUserConfig, subtask } from "hardhat/config";
import { getFullyQualifiedName } from "hardhat/utils/contract-names";
import { TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS } from "hardhat/builtin-tasks/task-names";
import { ResolvedFile } from "hardhat/types";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  createTestClient,
  TestClient,
  custom,
  createPublicClient,
  PublicClient,
  WalletClient,
  createWalletClient,
} from "viem";

/// This section creates files with the artifacts exported with const types

type ArtifactsEmittedPerFile = Array<{
  file: ResolvedFile;
  artifactsEmitted: string[];
}>;

subtask(TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS).setAction(
  async (
    {},
    { artifacts, config },
    runSuper
  ): Promise<{ artifactsEmittedPerFile: ArtifactsEmittedPerFile }> => {
    const {
      artifactsEmittedPerFile,
    }: { artifactsEmittedPerFile: ArtifactsEmittedPerFile } = await runSuper();

    for (const { file, artifactsEmitted } of artifactsEmittedPerFile) {
      const sourceFileDir = join(config.paths.artifacts, file.sourceName);
      await mkdir(sourceFileDir, {
        recursive: true,
      });

      const declarations = await Promise.all(
        artifactsEmitted.map(async (contractName) => {
          const fqn = getFullyQualifiedName(file.sourceName, contractName);
          const artifact = await artifacts.readArtifact(fqn);
          return `export const ${contractName} = ${JSON.stringify(
            artifact,
            undefined,
            2
          )} as const;`;
        })
      );

      await writeFile(
        join(sourceFileDir, "index.ts"),
        declarations.join("\n\n"),
        "utf-8"
      );
    }

    return { artifactsEmittedPerFile };
  }
);


// This section adds a property `viem` with the different clients to hardhat

import "hardhat/types/runtime";

declare module "hardhat/types/runtime" {
  interface HardhatViem {
    publicClient: PublicClient;
    walletClient: WalletClient;
    testClient: TestClient;
  }

  interface HardhatRuntimeEnvironment {
    viem: HardhatViem;
  }
}

extendEnvironment((hre) => {
  hre.viem = {
    publicClient: createPublicClient({
      transport: custom(hre.network.provider),
    }),
    walletClient: createWalletClient({
      transport: custom(hre.network.provider),
    }),
    // TODO: This can't be undefined for non-test networks :(
    testClient: createTestClient({
      transport: custom(hre.network.provider),
      mode: "hardhat", // TODO: This should be a setting
    }),
  };
});



// Normal config

const config: HardhatUserConfig = {
  solidity: "0.8.18",
};

export default config;
