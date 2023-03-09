import { extendEnvironment, HardhatUserConfig, subtask } from "hardhat/config";
import { getFullyQualifiedName } from "hardhat/utils/contract-names";
import {
  TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS,
  TASK_COMPILE_SOLIDITY,
} from "hardhat/builtin-tasks/task-names";
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

      const results = await Promise.all(
        artifactsEmitted.map(async (contractName) => {
          const fqn = getFullyQualifiedName(file.sourceName, contractName);
          const artifact = await artifacts.readArtifact(fqn);
          const json = JSON.stringify(artifact, undefined, 2);
          const declaration = `export type ${contractName}$Type = ${json};

export const ${contractName} : ${contractName}$Type = ${json}`;

          const typeName = `${contractName}$Type`;

          return { contractName, fqn, typeName, declaration };
        })
      );

      const ts = results.map((r) => r.declaration).join("\n\n");

      const dTs = `import "hardhat/types/artifacts";

${results.map((r) => `import { ${r.typeName} } from ".";`).join("\n")}

declare module "hardhat/types/artifacts" {
  interface ArtifactsMap {
    ${results
      .map((r) => `["${r.contractName}"]: ${r.typeName};`)
      .join("\n    ")}

    ${results.map((r) => `["${r.fqn}"]: ${r.typeName};`).join("\n    ")}
  }
}
      `;

      await writeFile(join(sourceFileDir, "index.ts"), ts, "utf-8");
      await writeFile(join(sourceFileDir, "artifacts.d.ts"), dTs, "utf-8");
    }

    return { artifactsEmittedPerFile };
  }
);

subtask(TASK_COMPILE_SOLIDITY).setAction(async (_, { config }, runSuper) => {
  const res = await runSuper();

  await writeFile(
    join(config.paths.artifacts, "artifacts.d.ts"),
    `import "hardhat/types/artifacts";

declare module "hardhat/types/artifacts" {
  interface ArtifactsMap {}

  interface Artifacts {
    readArtifact<ArgT extends keyof ArtifactsMap>(s: ArgT): ArtifactsMap[ArgT];
    readArtifact(s: string): Artifact;
    foo: number;
  }
}
`,
    "utf-8"
  );

  return res;
});

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
