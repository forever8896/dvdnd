# dvdnd on Stellar testnet

All transactions below are on Stellar testnet and can be opened on stellar.expert.

## Contracts

| Contract | ID |
|---|---|
| registry | [`CDWUC63EYRCEVQISAN7MZNAAOMT76VW6PTSVIUXTX3PDPXWJBNWJFJXY`](https://stellar.expert/explorer/testnet/contract/CDWUC63EYRCEVQISAN7MZNAAOMT76VW6PTSVIUXTX3PDPXWJBNWJFJXY) |
| gate (ZK eligibility) | [`CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N`](https://stellar.expert/explorer/testnet/contract/CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N) |
| offering (escrow raises) | [`CB5EJPS7K33FE3IGEFW6VINJD5MBL3HJ32I2JOAN34AMICBW73MZED3L`](https://stellar.expert/explorer/testnet/contract/CB5EJPS7K33FE3IGEFW6VINJD5MBL3HJ32I2JOAN34AMICBW73MZED3L) |
| vault (lock + dividends) | [`CCTY5CZFMXTBH4EPWKFHRVWDEHOFVEEWE3EPOGJEPKR65AJIG5CFLWX4`](https://stellar.expert/explorer/testnet/contract/CCTY5CZFMXTBH4EPWKFHRVWDEHOFVEEWE3EPOGJEPKR65AJIG5CFLWX4) |
| USDC (Circle testnet SAC) | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| ANDES share token (SAC) | [`CBFA36UZEPH6BC3CX3MDECAGLI4M44QMVP2GEJETPETZ65XRSFMCRIHN`](https://stellar.expert/explorer/testnet/contract/CBFA36UZEPH6BC3CX3MDECAGLI4M44QMVP2GEJETPETZ65XRSFMCRIHN) |

## Investor eligibility (real Groth16 proof verified on-chain)
- investor-ben credential added to the on-chain Poseidon Merkle tree: https://stellar.expert/explorer/testnet/tx/894c8bbf1a8a65261a23819d9e0055543b9995fda60842798c0172fdded8c239
- investor-ben residence proof verified, address registered: https://stellar.expert/explorer/testnet/tx/dbcd5ffd6e9b127f4b4f84805ccb5d366821945acca1198b495fcd1c14a0956f

## Andes Craft Brewing: raise to dividend (2026-10-25)
Raise: 1,000 USDC max at 1.00 USDC per token. Ana invests 600, Ben 400. The company receives 950, the treasury 50.
Ana locks 600 tokens and Ben 200, then the company pays an 80 USDC dividend: Ana receives 60, Ben 20.

- investor-ana invests 600 USDC: https://stellar.expert/explorer/testnet/tx/fd3d12f5b3b2b8f881d86f4ab83bc7ebc65d7aefe542e7165fc93e794c688d59
- investor-ben invests 400 USDC: https://stellar.expert/explorer/testnet/tx/132d050d16619d0e8f890dbcee17228823a2ad23d0b9d14eeebfbf3335b1977d
- Raise finalized (company paid, 5% fee): https://stellar.expert/explorer/testnet/tx/f88b52e9f43140cbd6984b4c3723b58e30ad6d4c40d30da7da2734b5438022b2
- investor-ana claims share tokens: https://stellar.expert/explorer/testnet/tx/97099497b957ec74251c13b3580bf5b3da67b026fec566cde7bee29120706aad
- investor-ben claims share tokens: https://stellar.expert/explorer/testnet/tx/afe3ab4667473de3f1caa4de126b3614940bc04043f3143d07a0b7406564089c
- investor-ana locks all tokens: https://stellar.expert/explorer/testnet/tx/a8242ce94830be9565d06d035811de91c6f6018af43ddb40875ad483115568f6
- investor-ben locks half: https://stellar.expert/explorer/testnet/tx/19a431d36a74c3ea3833922323a5112276a07cd417dc6ccf0d9390568610bc2a
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/91f785a685306630d22936a867dd1a0fe789cefca756768752eaae7bae2ef534
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/0064f36c79171c3f4caf5c3b6f6a89c8dbfead43d1b9baabaca6cb91cf840b61
- investor-ana claims dividend: https://stellar.expert/explorer/testnet/tx/30fdc7220a0570f36d42ac9cb751a8ad138e60243ccde1ecb7c7473617d52bd0
- investor-ben claims dividend: https://stellar.expert/explorer/testnet/tx/ef93afb2c71922d967be2cc1ab541f07d42302649f8373f827303c0b04813978

## HARBOR lifecycle (2026-10-25)
- investor-cara invests 600 USDC: https://stellar.expert/explorer/testnet/tx/5a3244c2fa9f8c536194af449ca6d31533a924dfddac1bb93ae465caecd6642a
- investor-dan invests 400 USDC: https://stellar.expert/explorer/testnet/tx/0120d68fb5707daa275754b896ce4b707f0c63427fdf30de4a13977609e3055e
- Raise finalized (company paid, 5% fee): https://stellar.expert/explorer/testnet/tx/c9dc06db166e66fa3ceedcdfafbdef5d90445ee6d0fe3e9be9526eb80c1720c0
- investor-cara claims share tokens: https://stellar.expert/explorer/testnet/tx/a50591349098e363256a42da8b238d6330f5840ecf310520a1389f8228819569
- investor-dan claims share tokens: https://stellar.expert/explorer/testnet/tx/46f0c9b45ad30951140e6c698f35126ace4e50ec0801ca89bdf816ebaee7e113
- investor-cara locks all tokens: https://stellar.expert/explorer/testnet/tx/8b6c6e43ddb514da6b02f3803f175a8892c977247a4dc06b83aa9c01399ad096
- investor-dan locks half: https://stellar.expert/explorer/testnet/tx/c5cd859132b3f99e955b5cbcf4e9c6b8e7bc558b838615e9eb38d9edb8ad14a7
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/fa9bd059bce7aa32fde884a10f32e3f35d70b51d845dbb717c9406ee758e4bac
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/9a2840c92a70eb422b92c5067f4a151b584929c2ea6517a40eaca60098b1d25b
- investor-cara claims dividend: https://stellar.expert/explorer/testnet/tx/f4f7d7eb88cec77795b25db970be39e36cd8fcdb47c2c6f803b9397b4ccf1fc3
- investor-dan claims dividend: https://stellar.expert/explorer/testnet/tx/ed4a58490ee21c1705f7b064c2cadd35a5b4494e6f0880a4a77b627f5245a209
