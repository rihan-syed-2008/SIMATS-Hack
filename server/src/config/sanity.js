require("dotenv").config();

const { createClient } = require("@sanity/client");

console.log("Loaded Project ID:", process.env.SANITY_PROJECT_ID); // Debug line

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

module.exports = client;
