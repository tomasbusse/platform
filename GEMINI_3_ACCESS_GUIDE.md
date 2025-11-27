# How to Get Access to Gemini 3 Pro & Nano Banana 2

## Gemini 3 Pro (Text/Reasoning Model)

### Option 1: Google AI Studio (Free tier available)
The easiest way to get started.

1. **Visit**: https://ai.google.dev
2. **Sign in** and get an API key
3. **Model ID**: `gemini-3-pro-preview`

**Pricing**: $2/million input tokens, $12/million output tokens (for prompts ≤200k tokens)

### Option 2: Gemini CLI (Requires subscription or paid API key)
If you have Google AI Ultra subscription or a paid API key:

1. **Update** to version 0.16.x or later
2. **Run** `/settings` and toggle "Preview features" to true
3. Gemini 3 Pro becomes the default model

### Option 3: Vertex AI (Enterprise)
Available through Google Cloud Platform for enterprise deployments.

---

## Nano Banana 2 / Gemini 3 Pro Image (Latest Image Generation Model)

"Nano Banana" is the community nickname for Google's image generation models. The latest is **Gemini 3 Pro Image**, released November 20, 2025.

### Option 1: Google AI Studio (Best for API access)

1. **Visit**: https://ai.google.dev
2. **Model ID**: `gemini-3-pro-image-preview`
3. **Free tier**: 1,500 requests per day

### Option 2: Gemini App (Quick testing)

1. **Visit**: https://gemini.google.com
2. Type "generate image [your prompt]"
3. You get ~50-100 free Pro generations before it switches to a lower-quality model

---

## Quick Start Code Example

```python
import google.generativeai as genai

genai.configure(api_key='YOUR_API_KEY')

# For text/reasoning with Gemini 3 Pro
model = genai.GenerativeModel('gemini-3-pro-preview')
response = model.generate_content('Your prompt here')

# For image generation with Nano Banana 2
image_model = genai.GenerativeModel('gemini-3-pro-image-preview')
image_response = image_model.generate_content('A futuristic cityscape at sunset')
```

---

## How to Enable Preview Features in Gemini CLI

Once you have Google AI Ultra or a paid API key:

### Method 1: Interactive Settings (Easiest)
```bash
# Start Gemini CLI interactively
gemini

# Then type in the chat:
/settings

# Toggle "Preview features" to true
# Gemini CLI will now default to Gemini 3 Pro
```

### Method 2: Direct Configuration
Update your settings file (`~/.gemini/settings.json`):
```json
{
  "apiKey": "your-paid-api-key-here",
  "previewFeatures": true
}
```

### Method 3: Command Line Flag
```bash
# Use --experimental flag to access preview features
gemini --experimental-preview-features
```

## Verify Gemini 3 Pro is Working

After enabling Preview Features:

```bash
gemini "What model are you? Please confirm if you are Gemini 3 Pro"
```

If it's working, Gemini should confirm it's using Gemini 3 Pro.

---

## What Makes Gemini 3 Pro Special?

According to Google's announcement, Gemini 3 Pro offers:

1. **State-of-the-art reasoning** - Better at understanding complex instructions
2. **Improved agentic coding** - Can plan and execute multi-step coding tasks
3. **Advanced tool use** - Orchestrates complex workflows across different services
4. **Better multimodal understanding** - Excellent at working with images, code, and text together
5. **60 FPS performance** - Optimized for real-time applications

---

## Model Summary

| Model | Model ID | Use Case | Free Tier |
|-------|----------|----------|-----------|
| Gemini 3 Pro | `gemini-3-pro-preview` | Text, reasoning, coding | Yes (limited) |
| Nano Banana 2 | `gemini-3-pro-image-preview` | Image generation | 1,500 req/day |

---

## Resources

- **Google AI Studio**: https://ai.google.dev
- **Gemini App**: https://gemini.google.com
- **Official Docs**: https://geminicli.com/docs
- **API Pricing**: https://ai.google.dev/pricing
