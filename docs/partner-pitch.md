🧾 AEMP — AI Edit Provenance

AEMP is a system that tracks and verifies how AI-generated images change over time.

❌ The problem

Today, AI detection answers:

“Was this AI-generated?”

But it cannot answer:

“What happened to this image after it was created?”

This creates:

misinformation risk
lack of trust in edited content
no audit trail for AI media

✅ The solution

AEMP introduces a visible + cryptographic edit history layer:

AI·0 → original AI image
AI·1–8 → verified edits
AI·9 → many edits
AI·X → broken or untrusted

Each step is:

cryptographically signed
chained to previous edits
embedded in the image itself
🔍 What makes it different

Most systems track origin.

AEMP tracks evolution.

⚙️ How it works
Subtle pixel watermark embedded in image
Hidden watermark stored in pixels
Signed JSON manifest (ECDSA)
Hash chain across edits
Hover-based reveal in supported viewers

💡 Use cases
AI image platforms (LimeWire, Midjourney-style tools)
News & media verification
Creative workflows
Social platforms
Marketplaces for AI content

🧱 Current stage
Working browser prototype AEM-P
End-to-end:
edit tracking
watermarking
verification
tamper detection

🚀 Next steps
API integration with AI generators
Cross-editor adoption
Stronger watermarking
Public verification layer

🌍 Vision

A universal “edit history layer” for AI media
