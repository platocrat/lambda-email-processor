# lambda-email-processor

## Table of Contents

- [1. High‑level flow](#1-highlevel-flow)
- [2. Repo structure](#r2-epo-structure)
- [3. Environment variables](#3-environment-variables-set-in-lambda→configuration→environment-variables)
- [4. Build & deploy (zip‑based)](#4-build--deploy-zipbased)
- [5. Local smoke‑tests](#5-local-smoketests)
- [6. Key points & gotchas](#6-key-points--gotchas)
- [7. Todo / ideas](#7-todo--ideas)


Serverless worker that **ingests Postmark inbound‑email events, processes them with OpenAI, stores artefacts in Cloudflare R2, and persists metadata to DynamoDB**.  
It is triggered automatically by messages arriving on an Amazon SQS queue (`mailmerge‑studio‑emails`) and runs inside AWS Lambda’s Node 22.x runtime on the free tier.

##  1. High‑level flow

```
Postmark Webhook (Next.js) ─► SQS Standard queue
│
▼
AWS Lambda (emailProcessor)
│
┌─────────────────────────┴──────────────────────────┐
│                                                    │
▸ OpenAI chat/completions                        Cloudflare R2
▸ Generate summary & charts                ▸ Store original attachments
▸ Store summary.txt + charts
│
▼
DynamoDB Projects table
```

##  2. Repo structure

```
.
├─ index.js                    # Lambda handler (CommonJS)
├─ node_modules/               # Node package dependencies
├─ lib/
│  ├─ constants.js             # NON‑secret config
│  └─ dynamodb.js              # DynamoDBDocumentClient factory
├─ services/
│  ├─ dataProcessing.js        # High‑level orchestration
│  ├─ dynamo.js                # DynamoDB helpers (addEmailToProject, etc.)
│  ├─ openai.js                # OpenAI wrapper
│  └─ r2.js                    # Cloudflare R2 wrapper
├─ utils.js                    # Logging helpers, misc
├─ sample‑inbound‑email.json   # Example of ExtractedInboundEmailData
├─ package.json
└─ package‑lock.json
```

## 3. Environment variables (set in **Lambda → Configuration → Environment variables**)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Secret key for OpenAI API |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API credentials |
| `R2_BUCKET_NAME` | Bucket where files are saved |
| `AWS_REGION` | Auto‑injected by Lambda (e.g. `us‑east‑1`) |

*(The Lambda execution role supplies AWS SDK credentials for DynamoDB & SQS.)*

## 4. Build & deploy (zip‑based)

```bash
# 1. Install deps
npm ci

# 2. Bundle code + node_modules
zip -r lambda-email-processor.zip \
    index.js node_modules lib/ services/ utils.js \
    package.json package-lock.json

# 3. Upload
aws lambda update-function-code \
  --function-name emailProcessor \
  --zip-file fileb://lambda-email-processor.zip
```

> After upload you can click **Deploy** in the AWS console or rely on the CLI call above.

## 5. Smoke‑tests

### 5.1. Local

In your terminal, run:

```bash
node -e "import('./index.js').then(m =>
  m.handler({ Records:[{ messageId:'1', body: JSON.stringify({subject:'hi', textBody:'hello'}) }] })
)"
```

### 5.2. With Lambda function

In the AWS Console under the `emailProcessor` Lambda function:

1. **Lambda console** → **Test** → select the **SQS** event template → paste a tiny test body:
    ```json
    {
      "Records": [{
        "messageId": "1",
        "body": "{\"subject\":\"hello\",\"textBody\":\"hi\"}"
      }]
    }
    ```

    *Expect a green success banner and no batchItemFailures.*

2. Send a **real email** to your Postmark inbound address.

3. In the **SQS console**, `ApproximateNumberOfMessagesSent` goes up, then returns to 0 (consumed).

4. In **CloudWatch Logs**», **check the** `emailProcessor` **log stream** – entries from `dataProcessingService` confirm the Lambda ran.

## 6. Key points & gotchas

1. **CommonJS vs ESM**
   Lambda defaults to CommonJS. Either stick with `require()`/`module.exports` (current setup) **or** add a `package.json` with `"type":"module"` to use `import/export`.

2. **Dependencies must be zipped**
   Inline editor will not install NPM packages. Always bundle `node_modules` when you use the OpenAI SDK or AWS SDK v3 clients.

3. **Partial‑batch response**
   `index.js` returns `{ batchItemFailures: [...] }` so a single bad email doesn’t poison the whole batch.

4. **Dead‑letter queue**
   Configure an SQS DLQ (`mailmerge‑studio‑emails‑dlq`) and set **MaxReceiveCount = 5** on the main queue.

5. **Free‑tier safe**

   * Lambda ≤ 1 M invocations/month
   * SQS ≤ 1 M requests/month
   * DynamoDB charges only on read/write units actually used
     Stay under those and the pipeline costs \$0.

## 7. Todo / ideas

* **Unit tests** for [`services/openai.js`](./services/openai.js) and [`services/r2.js`](./services/r2.js)
* **CloudFormation / SAM template** to provision SQS, DLQ, IAM, and Lambda in one command
* **Chunked attachment upload** for files > 5 MB

## License

MIT

## Authors

[@platocrat](https://github.com/platocrat)