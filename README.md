# hardhat-viem prototype

Just a prototype for now, which adds a `viem` instance to the HRE, which has alread-connected clients.

It also makes `hre.artifacts` types work great with `viem`.

Take a look at `test/basic-example.ts`.

## TODO

* [ ] How should we setup `chain` in the clients?
* [ ] How should we setup `mode` in the `TestClient`
* [ ] Can we avoid regenerating `artifacts.d.ts` every time compile is run?
* [ ] `artifacts.readArtifact`'s return type doesn't work well for generic artifacts / before compilation

The reason the first two are unclear is that Hardhat's initialization is sync, and we don't know to which chain we are connected to.
