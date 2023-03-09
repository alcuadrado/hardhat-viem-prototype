import { extendEnvironment, HardhatUserConfig, subtask } from "hardhat/config";
import {
  getFullyQualifiedName,
  parseFullyQualifiedName,
} from "hardhat/utils/contract-names";
import { rm } from "fs/promises";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";
import {
  TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS,
  TASK_COMPILE_SOLIDITY,
  TASK_COMPILE_REMOVE_OBSOLETE_ARTIFACTS,
} from "hardhat/builtin-tasks/task-names";
import { ResolvedFile } from "hardhat/types";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname, relative } from "path";
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

const AUTOGENERATED_FILE_PREFACE = `// This file was autogenerated by hardhat-viem, do not edit it.
// prettier-ignore
// tslint:disable
// eslint-disable
`;

// This override generates an artifacts.d.ts file that's used
// to type hre.artifacts
subtask(TASK_COMPILE_SOLIDITY).setAction(
  async (_, { config, artifacts }, runSuper) => {
    const res: any = await runSuper();

    const fqns = await artifacts.getAllFullyQualifiedNames();
    const contractNames = fqns.map(
      (fqn) => parseFullyQualifiedName(fqn).contractName
    );

    const duplicates = new Set();
    const existing = new Set();
    for (const name of contractNames) {
      if (existing.has(name)) {
        duplicates.add(name);
      }

      existing.add(name);
    }

    await writeFile(
      join(config.paths.artifacts, "artifacts.d.ts"),
      `${AUTOGENERATED_FILE_PREFACE}
import "hardhat/types/artifacts";

declare module "hardhat/types/artifacts" {
  interface ArtifactsMap {
    ${Array.from(duplicates)
      .map((name) => `${name}: never;`)
      .join("\n    ")}
  }

  interface Artifacts {
    readArtifact<ArgT extends keyof ArtifactsMap>(contractNameOrFullyQualifiedName: ArgT): ArtifactsMap[ArgT];
    readArtifact(contractNameOrFullyQualifiedName: string): Artifact;

    readArtifactSync<ArgT extends keyof ArtifactsMap>(contractNameOrFullyQualifiedName: ArgT): ArtifactsMap[ArgT];
    readArtifactSync(contractNameOrFullyQualifiedName: string): Artifact;
  }
}
`,
      "utf-8"
    );

    return res;
  }
);

// This override generates a .ts file per contract, and a file.d.ts
// per solidity file, which is used in conjunction to artifacts.d.ts
// to type hre.artifacts.
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

      const contractData = await Promise.all(
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

      for (const result of contractData) {
        const contractFile = `${AUTOGENERATED_FILE_PREFACE}
${result.declaration}`;

        await writeFile(
          join(sourceFileDir, `${result.contractName}.ts`),
          contractFile,
          "utf-8"
        );
      }

      const indexTs = `${AUTOGENERATED_FILE_PREFACE}
${contractData.map((r) => `export * from "./${r.contractName}";`).join("\n")}
`;

      const dTs = `${AUTOGENERATED_FILE_PREFACE}
import "hardhat/types/artifacts";

${contractData
  .map((r) => `import { ${r.typeName} } from "./${r.contractName}";`)
  .join("\n")}

declare module "hardhat/types/artifacts" {
  interface ArtifactsMap {
    ${contractData
      .map((r) => `["${r.contractName}"]: ${r.typeName};`)
      .join("\n    ")}

    ${contractData.map((r) => `["${r.fqn}"]: ${r.typeName};`).join("\n    ")}
  }
}
      `;

      await writeFile(join(sourceFileDir, "index.ts"), indexTs, "utf-8");
      await writeFile(join(sourceFileDir, "file.d.ts"), dTs, "utf-8");
    }

    return { artifactsEmittedPerFile };
  }
);

// This override deletes the obsolete dir files that were kept just because
// of the files that we generated
subtask(TASK_COMPILE_REMOVE_OBSOLETE_ARTIFACTS).setAction(
  async (_, { config, artifacts }, runSuper) => {
    const res: any = await runSuper();

    const fqns = await artifacts.getAllFullyQualifiedNames();
    const existingSourceFiles = new Set(
      fqns.map((fqn) => parseFullyQualifiedName(fqn).sourceName)
    );
    const allFilesDTs = await getAllFilesMatching(config.paths.artifacts, (f) =>
      f.endsWith("file.d.ts")
    );

    for (const fileDTs of allFilesDTs) {
      const dir = dirname(fileDTs);
      const sourceName = relative(config.paths.artifacts, dir);

      if (!existingSourceFiles.has(sourceName)) {
        await rm(dir, { force: true, recursive: true });
      }
    }

    return res;
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
