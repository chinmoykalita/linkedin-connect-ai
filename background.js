class OpenAIService {
  constructor() {
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
  }

  async generateConnectionMessage(profileData) {
    try {
      const config = await this.getConfiguration();
      if (!config.apiKey) {
        throw new Error('OpenAI API key not found. Please set it in the extension popup.');
      }
      if (!config.userName) {
        throw new Error('User name not found. Please set it in the extension popup.');
      }

      const prompt = this.createPrompt(profileData, config.userName);
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional networking expert who writes personalized LinkedIn connection request messages. Your messages should be concise (under 300 characters), professional, and personalized based on the recipient\'s profile information.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate message');
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw error;
    }
  }

  createPrompt(profileData, userName) {
    const { name, headline, company, location, about, experience, education, skills } = profileData;
    
    let prompt = `You are ${userName}. Write a personalized LinkedIn connection request message to ${name || 'this person'}.`;
    
    // Add profile information in order of importance
    if (headline) {
      prompt += ` They work as ${headline}.`;
    }
    
    if (company) {
      prompt += ` Currently at ${company}.`;
    }
    
    if (location) {
      prompt += ` Based in ${location}.`;
    }
    
    // Enhanced experience information
    if (experience && experience.length > 0) {
      const latestExperience = experience[0];
      prompt += ` Recent experience: ${latestExperience.title}`;
      if (latestExperience.company && latestExperience.company !== 'Company not specified') {
        prompt += ` at ${latestExperience.company}`;
      }
      if (latestExperience.duration && latestExperience.duration !== 'Duration not specified') {
        prompt += ` (${latestExperience.duration})`;
      }
      prompt += '.';
      
      // Add description if available
      if (latestExperience.description) {
        prompt += ` Their role involves: ${latestExperience.description.substring(0, 100)}${latestExperience.description.length > 100 ? '...' : ''}`;
      }
      
      // Mention career progression if multiple experiences
      if (experience.length > 1) {
        const previousRole = experience[1];
        prompt += ` Previously worked as ${previousRole.title}`;
        if (previousRole.company && previousRole.company !== 'Company not specified') {
          prompt += ` at ${previousRole.company}`;
        }
        prompt += '.';
      }
    }
    
    // Enhanced education information
    if (education && education.length > 0) {
      const latestEducation = education[0];
      prompt += ` Educated at ${latestEducation.school}`;
      if (latestEducation.degree && latestEducation.degree !== 'Degree not specified') {
        prompt += ` (${latestEducation.degree})`;
      }
      if (latestEducation.year) {
        prompt += ` - ${latestEducation.year}`;
      }
      prompt += '.';
    }
    
    // Enhanced skills information
    if (skills && skills.length > 0) {
      const topSkills = skills.slice(0, 5);
      prompt += ` Key skills include: ${topSkills.join(', ')}.`;
    }
    
    // Enhanced about section with better utilization
    if (about) {
      const truncatedAbout = about.length > 300 ? about.substring(0, 300) + '...' : about;
      prompt += ` About them: "${truncatedAbout}"`;
    }
    
    prompt += `\n\nWrite a connection request message from ${userName}'s perspective. The message should be:
1. Professional and friendly
2. Mention something specific from their profile (experience, education, skills, or background)
3. Explain why you want to connect (common interests, potential collaboration, learning opportunity, etc.)
4. Be genuine and personalized, not generic
5. Keep it under 200 characters to fit LinkedIn's limit
6. Do not include brackets, placeholder text, or generic phrases like "I'd love to connect"

Make it sound natural and authentic, like a real person reaching out with genuine interest.`;
    
    return prompt;
  }

  async getConfiguration() {
    try {
      // Try sync storage first
      const syncResult = await chrome.storage.sync.get(['openaiApiKey', 'userName']);
      if (syncResult.openaiApiKey || syncResult.userName) {
        console.log('Configuration loaded from chrome.storage.sync');
        return {
          apiKey: syncResult.openaiApiKey,
          userName: syncResult.userName
        };
      }
      
      // Fallback to local storage
      const localResult = await chrome.storage.local.get(['openaiApiKey', 'userName']);
      console.log('Configuration loaded from chrome.storage.local');
      return {
        apiKey: localResult.openaiApiKey,
        userName: localResult.userName
      };
    } catch (error) {
      console.error('Error loading configuration:', error);
      return {
        apiKey: null,
        userName: null
      };
    }
  }

  async setConfiguration(userName, apiKey) {
    try {
      await chrome.storage.sync.set({ 
        openaiApiKey: apiKey,
        userName: userName 
      });
      console.log('Configuration saved successfully to chrome.storage.sync');
    } catch (error) {
      console.error('Error saving to chrome.storage.sync:', error);
      // Fallback to local storage if sync fails
      try {
        await chrome.storage.local.set({ 
          openaiApiKey: apiKey,
          userName: userName 
        });
        console.log('Configuration saved successfully to chrome.storage.local as fallback');
      } catch (localError) {
        console.error('Error saving to chrome.storage.local:', localError);
        throw new Error('Failed to save configuration to both sync and local storage');
      }
    }
  }

  async getApiKey() {
    const config = await this.getConfiguration();
    return config.apiKey;
  }
}

const openAIService = new OpenAIService();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateMessage') {
    openAIService.generateConnectionMessage(request.profileData)
      .then(message => {
        sendResponse({ success: true, message });
      })
      .catch(error => {
        console.error('Error in background script:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Indicates that the response is asynchronous
  }
  
  if (request.action === 'setConfiguration') {
    openAIService.setConfiguration(request.userName, request.apiKey)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'getConfiguration') {
    openAIService.getConfiguration()
      .then(config => {
        sendResponse({ success: true, apiKey: config.apiKey, userName: config.userName });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
}); 