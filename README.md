AIM Protocol (AEM-P)
Hi — and welcome 👋
This is a small prototype exploring an idea:
What if AI-generated images could carry a simple, visible history of how they’ve been edited?
This project is my attempt at that. This repository was built with substantial AI assistance and human review.

🧠 The idea
Instead of only asking:
“Was this image AI-generated?”
AIM tries to answer:
“What happened to this image after it was created?”
It does this with a simple state system:
AI·0 → original AI-generated image
AI·1–8 → verified edits
AI·9 → many edits
EXT → external image (not AI-origin certified)
X → broken or unverifiable

✨ What’s in this repo
A browser-based prototype that shows:
a subtle (almost hidden) watermark
a hover-to-reveal effect
a simple edit counter
a JSON “manifest” that tracks changes
a basic verifier
It’s intentionally lightweight and easy to explore.

🧪 Try it
Just open:
index.html

No build step needed.

⚠️ Project status
This is a prototype / exploration project.
not actively maintained
not production-ready
no guarantees of correctness or security
I’m sharing it as:
a concept
a conversation starter
something others might build on

🧩 Important limitations
This project does not implement:
secure key management
strong or attack-resistant watermarking
production-grade verification
cross-platform trust infrastructure
So please don’t rely on it for anything critical.

🔐 License
MIT — use it however you like.
That means you can:
reuse the code
modify it
build on it
But also:
You use it at your own risk.

💬 Why I made this
AI images are everywhere now, and they change a lot after being created.
I was curious whether a simple, human-readable “edit history” could exist alongside them.
This repo is just one possible direction.

🙌 If you’re interested
Feel free to:
explore
fork
experiment
take the idea further
I’m not actively developing this, but I’m happy it might be useful to someone else.

🌍 Big picture
If this idea ever grows, I imagine something like:
a shared way to track how AI media evolves over time
But for now — this is just a small prototype.
Thanks for taking a look.


