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

## ANDES lifecycle (2026-10-25)

## ANDES lifecycle (2026-10-25)
- investor-eve invests 600 USDC: https://stellar.expert/explorer/testnet/tx/c6e5a0e5b1aa552f7a0f4a37227267d4edfdaabaae2e527a2100f2c231f465b4
- investor-finn invests 400 USDC: https://stellar.expert/explorer/testnet/tx/f15492480feac7410feeed038fcfb3c7a4ee55acde03726eeb7dfe29165a2896
- Raise finalized (company paid, 5% fee): https://stellar.expert/explorer/testnet/tx/5ae8041d0733ceb980156b38197a0f993385bd422052d32d8e5ca8d25b7eb850
- investor-eve claims share tokens: https://stellar.expert/explorer/testnet/tx/3ef8298f34f1bb2fe3b7347819a3699efa150497e2007e0df7e6801219dc52d6
- investor-finn claims share tokens: https://stellar.expert/explorer/testnet/tx/d8fb337baee06bd338755532e73fc651bacb99017bd6cbcf4e9a907808b04c6e
- investor-eve locks all tokens: https://stellar.expert/explorer/testnet/tx/67d1310a2dd3a12fd9a2c39ecbd369941fa9dd36db8844ab2d1cbe0c4e219943
- investor-finn locks half: https://stellar.expert/explorer/testnet/tx/64095f5e717af874cc9a125f8bc701fe913c004e2946460b729c00f73bda08b2
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/67de8b64f6ba5c0f0bde75dd8f91bdf3e4f8ea0a1ef641f538787f5fd1b427d0
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/a37f923524f8f1e614a00d843f5e4d45edc408f003f9f02cd5ff451640bdb7f0
- investor-eve claims dividend: https://stellar.expert/explorer/testnet/tx/1be8fee535cef0b1d064177c3360b6d77ec1848d65c4af38389d3885c13b047b
- investor-finn claims dividend: https://stellar.expert/explorer/testnet/tx/01d7b686d1bf1319305af86914c7abc2439775d3125595f62781f58f49b68ec7

## Residence circuit v2 + trusted setup (2026-10-25)
Leaf = Poseidon(country, expiry, Poseidon(secret)); the issuer builds it from the country it verified.
Keys from the ceremony in `circuits/ceremony/TRANSCRIPT.md` (PSE Perpetual Powers of Tau + phase 2 with a Stellar-ledger beacon).
- Gate verifying key replaced in place (`set_vk`): https://stellar.expert/explorer/testnet/tx/eac1ca528fe9bac89a19a6960f7670a725e0bb5c2641c53b0869fda421cd3fae
- vera (Japan) credential added at index 14: https://stellar.expert/explorer/testnet/tx/42a2e485980807603216f8d5a8d67a46eb3771732da1cf248da13c48ac412179
- vera's v2 proof verified on-chain: https://stellar.expert/explorer/testnet/tx/727eeabf8aa40fa8c80b3c5c1ec8f34b45100670bc2cab03376968511aa0f614
- App issuer from a commitment (live test), credential: https://stellar.expert/explorer/testnet/tx/390e4abc721c1f0950c6285c7de23980ac0fb71abca6136429ba1bdb3623b4c5
- Its proof verified: https://stellar.expert/explorer/testnet/tx/c468ba58aa94765a466e4958d33f95fd20f92c97277790f90c7d1d646079c896

## ANDES lifecycle (2026-10-25)
- investor-eve invests 600 USDC: https://stellar.expert/explorer/testnet/tx/09af9eb0126bbf1e265b4a347f75b49548ef8caed523e601d0a8c00679488302
- investor-finn invests 400 USDC: https://stellar.expert/explorer/testnet/tx/33d286a8428ae9093b8292dd85f4f7c8d85b10219c67f76568b4c447629868ce
- Raise finalized (company paid in full; flat fee was paid at open): https://stellar.expert/explorer/testnet/tx/f116698688773a3b0ec1ca55fed39d3e71e85389790eb67824d1d231f9f58ae7
- investor-eve claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/a61bb1374268451b74a156150f3a3b8c5441ea2341bdff043c3e202e24c9cc45
- investor-finn claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/98b9372e3ca516e83b59045a33ba38108be02f3ea364885c143310fc27cb1cd4
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/aff670e709b1375a9ac4a4a21e3d0a77107426ba0815dcb272e93e462bc746e6
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/c6eb359863c2772ad0aed6d653ef739def24148b655a7a59db2ba7ed44df6680
- investor-eve claims dividend: https://stellar.expert/explorer/testnet/tx/8ffaaa4c023774a65684cdf9081bad6e8a6b1dc88ca939f30d30edcf269de68b
- investor-finn claims dividend: https://stellar.expert/explorer/testnet/tx/486040c2dc2c9f7f6ad212b4ae3a909235c818d0cb41ee6bd30a8108bdf1e25b

## Offering with per-raise exemptions (2026-10-25)
New offering contract `CCBMO6FN53CBZILJ6PBU4DODLRYK27RQH5ESWVDPMNPVH5VILUZV4E5C` (flat listing fee of 10 USDC at open, per-raise terms and compliance).
Raises: 1 Northline (Reg S, open), 2 Harbor & Hearth (Reg D 506(c), one-year lock-up, open), 3 Andes (Reg S, full cycle above).
Lock-up check after the ANDES cycle (simulated calls, nothing sent): investor-eve's ANDES trustline is deauthorized with a wallet
balance of 0 and 600 tokens active in the vault; `vault.unlock` fails with the token's BalanceDeauthorizedError (#11) and
`offering.release` fails with LockedUp (#14) until the lock-up date.

## ANDES lifecycle (2026-10-25)
- investor-eve invests 600 USDC: https://stellar.expert/explorer/testnet/tx/e1322854f2603c4771fb5680b2e49dcc3e3e565122ab8a1e757f3ddb0c6eb186
- investor-finn invests 400 USDC: https://stellar.expert/explorer/testnet/tx/9a87cf73b0d57413875795ecef0e389d700178b7215fb0bf24c62deee023d8ac
- Raise finalized (company paid in full; flat fee was paid at open): https://stellar.expert/explorer/testnet/tx/9eb66157fc7364573c66afbef8ae7122097c45cf8e8e067065850e72df088045
- investor-eve claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/0941618c99f629d038a5d7415e3031c0187c9bc46a9f2ead153f8c7081f58bf5
- investor-finn claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/003e6bdbd9f6b55e4ddcc43759a340150f846b77ee6c2f05a803dbe6ec7fd5c7
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/fd44396e02348c65465b8844ade79bb4cf7d67f7ba18e4753d5706db7fc0ebec
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/abd8e9112097a806292cc6cddecc7ee1ad75d71eabf7a82a8e505500c67dff96
- investor-eve claims dividend: https://stellar.expert/explorer/testnet/tx/c930bdb098cc1ddf3dfb3fd727aa546e580161b71f42374adc0df0d44baf9406
- investor-finn claims dividend: https://stellar.expert/explorer/testnet/tx/9b8804a6f071520a239ce45397ab804af7ff5b4ddec58a724bc19111ac94c1eb

## Reg S and 506(c) side by side (2026-10-25)
Offering `CCJCRABWLOEOXVDRHSJXLS5HDOCUCZWY2X2N27NUP24H62N6DKYISX5P`: raises can run both exemptions; self-certified entities need 1,000,000 USDC.
Raises: 1 Northline (Reg S + 506(c), one-year lock-up), 2 Harbor & Hearth (506(c)), 3 Andes (Reg S, full cycle above).

## ANDES lifecycle (2026-10-25)
- investor-eve invests 600 USDC: https://stellar.expert/explorer/testnet/tx/aa1be942be364baa256b05b54c7530690e69480007601c575c480257aed6f914
- investor-finn invests 400 USDC: https://stellar.expert/explorer/testnet/tx/1722045d000c585783523578d4bc751bbd455367c21780caaf3e13d9b64a8660
- Raise finalized (company paid in full; flat fee was paid at open): https://stellar.expert/explorer/testnet/tx/45d20708e9c1d2a4d6ecf81f0a15ee0b74093c9c82519d84613ef7c6aa368430
- investor-eve claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/e0d69184d7974414417769811edb23b254325464d1e03de08a76033c2271fb05
- investor-finn claims share tokens (locked in the vault during lock-up): https://stellar.expert/explorer/testnet/tx/5153184964d54a2e2a238fb9442be5583b498443e64fb0ae4fbdd27cf759c9bd
- First dividend period starts: https://stellar.expert/explorer/testnet/tx/1787fc7cd91a92d5ae6829746745a39f5acca0a6986ef8de751259b5486e1f27
- Company pays 80 USDC dividend: https://stellar.expert/explorer/testnet/tx/d56f5c934e27e8a55aa51d738d4dbf796049135f033e2df3ee20219de0ee1a3c
- investor-eve claims dividend: https://stellar.expert/explorer/testnet/tx/66730f93302700044e7dc7723ee498c2144744422e9c3e6fc74413c17c7305c7
- investor-finn claims dividend: https://stellar.expert/explorer/testnet/tx/204967a1717c2010f7ee0f2bd43dc1a4d5a5477a815da00598e439d9deca0a28

## Verifiable agreements, council multisig, compliance console (2026-10-25)
Companies now sign the exact plain-language agreement the app shows (app/src/lib/agreement.ts); raise pages rebuild it from on-chain fields and check its sha256 against the registry.
Reseeded raises: 4 Northline (Reg S + 506(c)), 5 Harbor & Hearth (506(c)), 6 Andes (Reg S, full cycle above).
Old demo companies suspended by the 2-of-3 council (two council signatures, master key disabled):
- company 8: https://stellar.expert/explorer/testnet/tx/c23e67f2ca431892ae08abb87eb8a9c3cc0c6413209f774592b95b4f5dc806d3
- company 9: https://stellar.expert/explorer/testnet/tx/475401ce6ec96a32aa24bb6fddb485adca9232da3757e448d4a839e1469f9b5a
- company 10: https://stellar.expert/explorer/testnet/tx/7b3d56351153fc40d0a062df6e94740719b6c3fcdb9f81f7fd256533a5cd897e
Compliance action recorded with a reason (Andes compliance account freezes a holder, shown in the console's audit log):
- https://stellar.expert/explorer/testnet/tx/8fa64eebe1bcf36e0ffaf521f56b828ea48a77025836174121d2e18c3c081244

## Timelock and secondary trading (2026-10-25)
Timelock `CCHX6UXEPIXLRALJIK2JZWCQ3OLQER7HYOGFVYYYSOP2UJERLEEEGCGZ` (proposer: council, delay 10 minutes on testnet) is now admin of the registry and the offering.
The first timelock (`CBWDBHPVZ435XL4UVUIXO4PFUEA7S4XENSKVUDI7XSXA2C3DZOBQWHWC`) had call ids that included the execution time, so normal schedules failed; the council
scheduled the hand-over on it with a pre-declared footprint, and it executed after the delay:
- registry admin → new timelock: https://stellar.expert/explorer/testnet/tx/95dca7f8209998b9983f39570dd818f65e3f53249591d86824e4ce65285f9d58
- offering admin → new timelock: https://stellar.expert/explorer/testnet/tx/2b1cb6a7990291d6319bf8db6b7a4e3385d483362c8cc44b9afcb12c72053e28
Kestrel Coffee Roasters (raise 7, Reg S, no lock-up beyond the deadline): eve and finn invested 300 each, claimed into their wallets,
and traded on the SDEX through the app: 20 KESTREL at 1.10 USDC from eve to finn.
