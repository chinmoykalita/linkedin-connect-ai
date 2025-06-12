# LinkedIn Connect AI Chrome Extension

A powerful Chrome extension that uses AI to craft personalized LinkedIn connection request messages automatically. Simply visit any LinkedIn profile and let AI generate a customized message based on the person's profile information.

## 🚀 Features

- **AI-Powered Messages**: Uses OpenAI's GPT to generate personalized connection requests
- **Automatic Profile Parsing**: Extracts name, headline, company, experience, education, and skills
- **One-Click Generation**: Just click the "🤖 AI Connect" button on any profile
- **Editable Messages**: Review and customize messages before sending
- **Secure Storage**: API keys are stored securely in Chrome's sync storage
- **Modern UI**: Clean, professional interface that integrates seamlessly with LinkedIn

## 📋 Prerequisites

1. **Chrome Browser**: This extension works with Google Chrome
2. **OpenAI API Key**: You'll need an OpenAI API key to use the AI features
   - Sign up at [OpenAI Platform](https://platform.openai.com/)
   - Navigate to [API Keys](https://platform.openai.com/api-keys)
   - Create a new API key

## 🔧 Installation

### Option 1: Load as Unpacked Extension (Recommended for Development)

1. **Download or Clone the Extension**:
   ```bash
   git clone <repository-url>
   cd linkedin-connect-ai
   ```

2. **Open Chrome Extensions Page**:
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `linkedin-connect-ai` folder
   - The extension should now appear in your extensions list

4. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome's toolbar
   - Pin "LinkedIn Connect AI" for easy access

### Option 2: Create CRX Package

1. In Chrome extensions page (`chrome://extensions/`)
2. Click "Pack extension"
3. Select the extension directory
4. Generate the `.crx` file
5. Install the `.crx` file

## ⚙️ Setup

1. **Configure API Key**:
   - Click the LinkedIn Connect AI extension icon
   - Enter your OpenAI API key
   - Click "Save Configuration"

2. **Verify Setup**:
   - The extension should show "Ready to use!" message
   - Your API key is now securely stored

## 🎯 Usage

1. **Visit a LinkedIn Profile**:
   - Navigate to any LinkedIn profile (`linkedin.com/in/username`)
   - Wait for the page to fully load

2. **Generate AI Message**:
   - Look for the "🤖 AI Connect" button near the Connect button
   - Click it to generate a personalized message

3. **Review and Customize**:
   - A modal will appear with the generated message
   - Edit the message if needed
   - Copy the message or click "Send Connect Request"

4. **Send Connection**:
   - The extension will attempt to populate LinkedIn's connection form
   - Review and send your connection request

## 🔍 How It Works

### Profile Data Extraction
The extension analyzes the following profile elements:
- **Name**: Professional name
- **Headline**: Current role/title
- **Company**: Current workplace
- **Location**: Geographic location
- **About**: Profile summary
- **Experience**: Recent work history (top 3)
- **Education**: Educational background (top 2)
- **Skills**: Listed skills (top 10)

### AI Message Generation
- Sends profile data to OpenAI's GPT-3.5-turbo model
- Uses a specialized prompt for professional networking
- Generates messages under 300 characters (LinkedIn's limit)
- Focuses on personalization and professionalism

### Privacy & Security
- API keys stored locally in Chrome's secure storage
- No profile data is stored permanently
- All API calls made directly to OpenAI (no intermediary servers)

## 🛠️ Customization

### Modifying the AI Prompt
Edit the `createPrompt` method in `background.js` to customize how messages are generated:

```javascript
createPrompt(profileData) {
  // Customize this method to change AI behavior
  let prompt = `Write a personalized LinkedIn connection request...`;
  // Add your custom logic here
  return prompt;
}
```

### Styling Customization
Modify `styles.css` to change the appearance of injected elements:

```css
.ai-connect-btn {
  /* Customize button appearance */
  background: your-color !important;
}
```

### Profile Parsing
Update selectors in `content.js` if LinkedIn changes their layout:

```javascript
const selectors = {
  name: 'h1.text-heading-xlarge',
  // Update selectors as needed
};
```

## 🐛 Troubleshooting

### Extension Not Working
1. Check if you're on a LinkedIn profile page (`/in/username`)
2. Refresh the page and wait for full load
3. Ensure API key is properly configured
4. Check Chrome Developer Console for errors

### AI Button Not Appearing
1. Verify you're on a profile page (not company/group page)
2. Look for LinkedIn's Connect button first
3. Try refreshing the page
4. Check if ad blockers are interfering

### API Errors
1. Verify your OpenAI API key is valid
2. Check your OpenAI account has sufficient credits
3. Ensure internet connection is stable
4. Try generating a message again

### Message Generation Issues
1. Check Chrome Developer Console for detailed errors
2. Verify profile has sufficient information
3. Try with different profiles
4. Check OpenAI service status

## 📁 File Structure

```
linkedin-connect-ai/
├── manifest.json          # Chrome extension configuration
├── content.js             # LinkedIn page interaction script
├── background.js          # OpenAI API service worker
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── styles.css             # LinkedIn page styles
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # Documentation
```

## 🔒 Privacy Policy

- No personal data is collected or stored by this extension
- Profile data is only used temporarily for AI message generation
- API keys are stored locally in Chrome's secure storage
- No analytics or tracking implemented

## 📈 API Usage & Costs

- Each message generation uses ~150-200 tokens
- Estimated cost: $0.0003-0.0004 per message with GPT-3.5-turbo
- Monitor usage in your OpenAI dashboard
- Consider setting usage limits in OpenAI console

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

- This extension is not affiliated with LinkedIn Corporation
- Use responsibly and in accordance with LinkedIn's Terms of Service
- Respect connection limits and avoid spam
- Always personalize and review generated messages

## 🆘 Support

If you encounter issues:
1. Check this README for troubleshooting steps
2. Review Chrome Developer Console for errors
3. Ensure all prerequisites are met
4. Create an issue in the repository

---

**Made with ❤️ for better professional networking** 