// server.js — Humanity Coin Backend
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import fs from "fs";
import fetch from "node-fetch"; // For internal webhook calls

// ----------------------------
// 🧩 INITIAL SETUP
// ----------------------------
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load your treasury wallet (never share this file!)
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync("./treasury.json")));
const treasury = Keypair.fromSecretKey(secretKey);

// ✅ Connect to Solana mainnet
const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

// ✅ HUM Token Mint (your real token)
const HUM_MINT = new PublicKey("94au8hfP6cSEdnqxqdGgFuh7k3iHyhmNfzSkccopRDCW");

// ✅ Your AdGem Postback Key (from AdGem dashboard)
const ADGEM_KEY = "le9nnnl93cah313bbnec987a";

// ----------------------------
// 🪙 REWARD ENDPOINT (manual claim or test)
// ----------------------------
app.post("/reward", async (req, res) => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet || !amount)
      return res.status(400).json({ error: "Missing wallet or amount" });

    const userWallet = new PublicKey(wallet);

    // Find or create token accounts
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

    // Transfer HUM tokens
    const signature = await transfer(
      connection,
      treasury,
      fromTokenAccount.address,
      toTokenAccount.address,
      treasury.publicKey,
      amount * 10 ** 6 // HUM has 6 decimals
    );

    console.log(`✅ Sent ${amount} HUM to ${wallet} | Tx: ${signature}`);
    res.json({ success: true, signature });
  } catch (err) {
    console.error("❌ Transfer error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 💸 ADGEM WEBHOOK (auto-rewards after offer completion)
// ----------------------------
app.post("/adgem-webhook", async (req, res) => {
  try {
    const data = req.body;
    console.log("📩 AdGem webhook received:", data);

    const playerWallet = data.player_id;
    const rewardAmount = Number(data.amount) || 0;
    const secret = req.query.secret || req.headers["x-adgem-secret"];

    if (!playerWallet) {
      console.log("❌ No player_id provided in webhook");
      return res.status(400).json({ error: "Missing player_id" });
    }

    // Optional security check
    if (ADGEM_KEY && secret && secret !== ADGEM_KEY) {
      console.log("❌ Invalid AdGem secret");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Auto-send HUM reward by calling the same /reward endpoint
    const response = await fetch("http://localhost:5000/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: playerWallet, amount: rewardAmount }),
    });

    const result = await response.json();
    console.log(`✅ AdGem reward processed for ${playerWallet}: ${rewardAmount} HUM`);
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ Error in AdGem webhook:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🚀 START SERVER
// ----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 HUM backend running on http://localhost:${PORT}`);
});
