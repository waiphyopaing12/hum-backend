// server.js — Humanity Coin Backend (clean version)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import fs from "fs";

// ----------------------------
// 🧩 INITIAL SETUP
// ----------------------------
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load your treasury wallet (never share this file!)
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync("./treasury.json")));
const treasury = Keypair.fromSecretKey(secretKey);

// ✅ Use Helius RPC (fast, no 429 errors)
const connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=34cf9787-2ce6-4082-87ac-8670ff72dacd",
  "confirmed"
);

// ✅ Humanity Coin mint address
const HUM_MINT = new PublicKey("94au8hfP6cSEdnqxqdGgFuh7k3iHyhmNfzSkccopRDCW");

// ----------------------------
// 🪙 /reward — universal endpoint for all offerwalls
// ----------------------------
app.post("/reward", async (req, res) => {
  try {
    const { wallet, amount, sourceId } = req.body;
    if (!wallet || !amount)
      return res.status(400).json({ error: "Missing wallet or amount" });

    const userWallet = new PublicKey(wallet);

    // Create token accounts if needed
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      HUM_MINT,
      treasury.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      HUM_MINT,
      userWallet
    );

    // Send HUM tokens
    const signature = await transfer(
      connection,
      treasury,
      fromTokenAccount.address,
      toTokenAccount.address,
      treasury.publicKey,
      amount * 10 ** 6 // 6 decimals
    );

    console.log(
      `✅ Sent ${amount} HUM to ${wallet} | Source: ${sourceId || "manual"} | Tx: ${signature}`
    );
    res.json({ success: true, signature });
  } catch (err) {
    console.error("❌ Transfer error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🚀 START SERVER
// ----------------------------
const PORT = process.env.PORT || 10000; // Render uses dynamic ports
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 HUM backend running on port ${PORT}`);
});
