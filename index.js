// LINE Vision Bot（くまお先生）LaTeX変換＆Web検索＆クイズ評価＆再解説対応！

const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const getRawBody = require('raw-body');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

let lastExplanation = '';
let lastQuizAnswer = '';

function convertLatexToReadable(text) {
  return text
    .replace(/\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
    .replace(/\times|\btimes\b|\stimes|\*|\*\*/g, '×')
    .replace(/\div|\bdiv\b|\//g, '÷')
    .replace(/\cdot/g, '・')
    .replace(/\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\left\(|\right\)/g, '')
    .replace(/[\[\]()]/g, '')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\\/g, '')
    .replace(/\bsqrt\b/g, '√')
    .replace(/\bsprt\b/gi, '√')
    .replace(/\bsprt/gi, '√')
    .replace(/sprt/gi, '√')
    .replace(/\bpm\b/g, '±')
    .replace(/\bneq\b/g, '≠')
    .replace(/\bgeq\b/g, '≥')
    .replace(/\bleq\b/g, '≤')
    .replace(/\balpha\b/g, 'α')
    .replace(/\bbeta\b/g, 'β')
    .replace(/\bgamma\b/g, 'γ')
    .replace(/\btheta\b/g, 'θ')
    .replace(/\blambda\b/g, 'λ')
    .replace(/\bsigma\b/g, 'σ')
    .replace(/\bpi\b/g, 'π')
    .replace(/\binfty\b/g, '∞')
    .replace(/\bln\b/g, 'ln')
    .replace(/\blog\b/g, 'log')
    .replace(/\bexp\b/g, 'exp')
    .replace(/\bapprox\b/g, '≈')
    .replace(/\bto\b/g, '→')
    .replace(/\bbegin\{.*?\}|\bend\{.*?\}/g, '')
    .replace(/\$/g, '')
    .replace(/\\n/g, '\n');
}

// 🔁 D選択肢「ちょっとわからない」対応を含めた本気モード再解説は、
// クイズの回答処理部分と組み合わせてLINEメッセージで分岐を追加することで実装可能！
