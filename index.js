const express = require('express');
const fs = require('fs');
const app = express()
const port = 3001;
const wasmFile = fs.readFileSync('./node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
const wasmModule = new WebAssembly.Module(wasmFile);
const  { Tiktoken, init } = require('@dqbd/tiktoken/lite/init');
const tiktokenModel = require('@dqbd/tiktoken/encoders/cl100k_base.json');

app.post('/', (req, res) => {
  res.send('Hello World!')
})

async function main() {
  await init((imports) => WebAssembly.instantiate(wasmModule, imports));
  const encoding = new Tiktoken(
    tiktokenModel.bpe_ranks,
    tiktokenModel.special_tokens,
    tiktokenModel.pat_str,
  );
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

main()

