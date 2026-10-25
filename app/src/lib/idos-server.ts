// idOS on the server: signs KYC links for the relay, and reads the KYC
// credential an investor shared with us (decrypted with our consumer key and
// checked against the accepted issuer's signature) to get their verified
// country of residence. Only the country leaves this module.

import "server-only";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { idOSConsumer } from "@idos-network/consumer";
import { IDOS, IS_TESTNET } from "./config";
import { IssueError, countryCode } from "./issuer";

let consumer: Promise<idOSConsumer> | null = null;

function getConsumer() {
  if (!consumer) {
    const auth = process.env.IDOS_CONSUMER_AUTH_KEY;
    const enc = process.env.IDOS_CONSUMER_ENC_KEY;
    if (!auth || !enc) throw new IssueError("idOS is not configured on the server.", 500);
    consumer = idOSConsumer
      .init({
        consumerSigner: nacl.sign.keyPair.fromSecretKey(Buffer.from(auth, "hex")),
        recipientEncryptionPrivateKey: enc,
        nodeUrl: IDOS.nodeUrl,
      })
      .catch((e) => {
        consumer = null;
        throw e;
      });
  }
  return consumer;
}

/** A one-hour link to the idOS relay's KYC flow; the relay only accepts this EVM wallet. */
export function kycLink(evmAddress: string) {
  const key = process.env.IDOS_RELAY_PRIVATE_KEY;
  const clientId = process.env.NEXT_PUBLIC_IDOS_RELAY_CLIENT_ID;
  if (!key || !clientId) throw new IssueError("idOS KYC is not configured on the server.", 500);
  const token = jwt.sign(
    { clientId, level: "plus+liveness+idos", walletAddress: evmAddress, externalUserId: evmAddress, kyc: true },
    key.replace(/\\n/g, "\n"),
    { algorithm: "ES512", expiresIn: "1h" },
  );
  return `${IDOS.relayUrl}/kyc?token=${encodeURIComponent(token)}`;
}

type Subject = { residentialAddressCountry?: string; idDocumentCountry?: string };
type KycCredential = { expirationDate?: string; credentialSubject?: Subject };

export type Residence = { country: number; basis: "residential address" | "ID document" };

/**
 * The verified residence country from a KYC credential `userId` shared with us.
 * Uses the residential address; on testnet, falls back to the ID document's
 * country when the credential has no address (lighter KYC levels).
 */
export async function verifiedResidence(userId: string): Promise<Residence> {
  const c = await getConsumer();
  const { grants } = await c.getAccessGrants({ user_id: userId, page: 1, size: 20 });
  if (!grants.length) throw new IssueError("Share your idOS credential with dvdnd first.", 404);

  const issuers = [{ issuer: IDOS.acceptedIssuerId, publicKeyMultibase: IDOS.acceptedIssuerPublicKey }];
  let lastError = "None of your shared credentials could be verified.";
  for (const grant of grants) {
    if (grant.ag_owner_user_id !== userId) continue;
    let credential: KycCredential;
    try {
      credential = JSON.parse(await c.getCredentialSharedContentDecrypted(grant.data_id)) as KycCredential;
    } catch {
      continue; // not a KYC credential we can read
    }
    const [ok] = await c.verifyCredential(credential as Parameters<typeof c.verifyCredential>[0], issuers);
    if (!ok) continue;
    if (credential.expirationDate && Date.parse(credential.expirationDate) < Date.now()) {
      lastError = "Your idOS credential has expired. Run the identity check again.";
      continue;
    }
    const s = credential.credentialSubject ?? {};
    if (s.residentialAddressCountry) return { country: countryCode(s.residentialAddressCountry), basis: "residential address" };
    if (IS_TESTNET && s.idDocumentCountry) return { country: countryCode(s.idDocumentCountry), basis: "ID document" };
    lastError = "Your idOS credential doesn't include a verified residential address.";
  }
  throw new IssueError(lastError, 422);
}
