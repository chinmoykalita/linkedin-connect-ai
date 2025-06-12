class LinkedInProfileParser {
  constructor() {
    this.profileData = {};
    // Cache for Voyager profile response to avoid repeated network calls
    this.voyagerDataCache = null;
    // Feature flag: fall back to LinkedIn Voyager API (beware of rate-limits)
    this.useVoyagerFallback = true;
    // Timestamp of the last full parse to throttle repeated parsing
    this.lastParseAt = 0;
    // Retry control for parsing loops
    this.maxParseAttempts = 3;
    this.parseAttempts = 0;
    this.hasValidProfile = false;
    this.init();
  }

  init() {
    console.log('LinkedIn Connect AI: Initializing on page:', window.location.href);
    if (this.isProfilePage()) {
      console.log('LinkedIn Connect AI: This is a profile page, proceeding...');
      // Add delay to ensure page is fully loaded
      setTimeout(async () => {
        await this.parseProfile();
        this.injectAIButton();
      }, 2000);
      this.observePageChanges();
    } else {
      console.log('LinkedIn Connect AI: Not a profile page, skipping...');
    }
  }

  isProfilePage() {
    return window.location.pathname.startsWith('/in/') && 
           !window.location.pathname.includes('/edit');
  }

  async parseProfile() {
    // If we already parsed successfully, no need to continue
    if (this.hasValidProfile) return;

    // Increment parse attempts and exit early if over limit
    this.parseAttempts += 1;
    if (this.parseAttempts > this.maxParseAttempts) {
      console.warn('LinkedIn Connect AI: Max parse attempts reached. Stopping further parsing.');
      if (this.pageObserver) this.pageObserver.disconnect();
      return;
    }

    const selectors = {
      name: 'h1.text-heading-xlarge',
      headline: '.text-body-medium.break-words',
      location: '.text-body-small.inline.t-black--light.break-words',
      company: '.inline-show-more-text .mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
      about: '.inline-show-more-text--is-expanded .break-words span[aria-hidden="true"]',
      experience: '.pvs-list__paged-list-item .display-flex.flex-column.full-width',
      education: '.pvs-list__paged-list-item .display-flex.flex-column.full-width',
      skills: '.pvs-list .mr1.hoverable-link-text.t-bold span[aria-hidden="true"]'
    };

    // Use multiple selector strategies for better data extraction
    const name = this.getTextContent('h1.text-heading-xlarge') || 
                 this.getTextContent('h1.pv-top-card-section__name') ||
                 this.getTextContent('.pv-text-details__left-panel h1') ||
                 this.getTextContent('.ph5 h1');

    const headline = this.getTextContent('.text-body-medium.break-words') ||
                     this.getTextContent('.pv-top-card-section__headline') ||
                     this.getTextContent('.pv-text-details__left-panel .text-body-medium');

    let about = this.getAboutSection();
    let experience = this.getExperience();
    let education = this.getEducation();

    // Optional Voyager API fallback (disabled by default to avoid rate-limiting)
    if (this.useVoyagerFallback && ((!about || about.length < 30) || experience.length === 0 || education.length === 0)) {
      // Also use voyager fallback for education when none found via DOM
      const needEducation = education.length === 0;
      if (!this.voyagerDataCache) {
        console.log('LinkedIn Connect AI: Falling back to Voyager API for missing data...');
        this.voyagerDataCache = await this.fetchVoyagerProfile();
      }
      const voyagerData = this.voyagerDataCache;
      if (voyagerData) {
        if (!about || about.length < 30) {
          about = this.extractSummaryFromVoyager(voyagerData) || about;
        }
        if (experience.length === 0) {
          experience = this.extractExperienceFromVoyager(voyagerData);
        }
        if (needEducation) {
          education = this.extractEducationFromVoyager(voyagerData);
        }
      }
    }

    this.profileData = {
      name: name,
      headline: headline,
      location: this.getTextContent(selectors.location),
      company: this.getTextContent(selectors.company),
      about: about,
      experience: experience,
      education: education,
      skills: this.getSkills(),
      profileUrl: window.location.href
    };

    console.log('Parsed LinkedIn Profile:', this.profileData);

    // If we now have a non-empty about section (summary) mark as valid and stop observing
    if (this.profileData.about && this.profileData.about.length > 30) {
      this.hasValidProfile = true;
      if (this.pageObserver) this.pageObserver.disconnect();
    }
  }

  getTextContent(selector) {
    const element = document.querySelector(selector);
    return element ? element.textContent.trim() : '';
  }

  getAboutSection() {
    // Enhanced about section parsing with more comprehensive selectors
    const aboutSelectors = [
      // Modern LinkedIn selectors
      '.pv-shared-text-with-see-more .full-text',
      '.pv-shared-text-with-see-more .inline-show-more-text span[aria-hidden="true"]',
      '.pv-shared-text-with-see-more .visually-hidden',
      
      // Section-based selectors
      '#about ~ .pvs-list__container .full-text',
      '#about ~ .pvs-list__container .inline-show-more-text span[aria-hidden="true"]',
      '#about ~ .pvs-list__container .break-words span[aria-hidden="true"]',
      
      // Alternative about selectors
      '.pv-about-section .pv-about__summary-text .lt-line-clamp__raw-line',
      '.pv-about-section .inline-show-more-text span[aria-hidden="true"]',
      
      // Data attribute selectors
      '[data-field="summary_expanded"] .inline-show-more-text span[aria-hidden="true"]',
      '[data-field="summary_expanded"] .full-text',
      
      // Voyager selectors
      '.pv-text-details__left-panel .pv-shared-text-with-see-more',
      '.pvs-header + div .inline-show-more-text span[aria-hidden="true"]',
      
      // New selectors for better bio extraction
      'section[data-section="summary"] .inline-show-more-text span[aria-hidden="true"]',
      'section[data-section="summary"] .full-text',
      '.pv-profile-section__card-action-bar ~ .pv-shared-text-with-see-more span[aria-hidden="true"]',
      
      // Additional fallback selectors
      '.pvs-list__outer-container .break-words span[aria-hidden="true"]',
      '.profile-section-card .pv-shared-text-with-see-more span[aria-hidden="true"]'
    ];

    console.log('LinkedIn Connect AI: Searching for about section...');

    for (const selector of aboutSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();
        // Filter out short or irrelevant text
        if (text.length > 30 && !this.isIrrelevantText(text)) {
          console.log('LinkedIn Connect AI: Found about text with selector:', selector);
          return text;
        }
      }
    }

    // More comprehensive fallback search
    const aboutSection = document.querySelector('#about');
    if (aboutSection) {
      console.log('LinkedIn Connect AI: Found about section, searching for text...');
      
      // Look in the next sibling or parent section
      const parentSection = aboutSection.closest('section') || aboutSection.parentElement;
      if (parentSection) {
        // Try various text containers
        const textSelectors = [
          '.inline-show-more-text span[aria-hidden="true"]',
          '.full-text',
          '.pv-shared-text-with-see-more',
          '.lt-line-clamp__raw-line',
          '.break-words span[aria-hidden="true"]',
          '.pvs-list__container span[aria-hidden="true"]',
          '.pvs-list__outer-container span[aria-hidden="true"]'
        ];
        
        for (const textSelector of textSelectors) {
          const textElement = parentSection.querySelector(textSelector);
          if (textElement && textElement.textContent.trim().length > 30) {
            const text = textElement.textContent.trim();
            if (!this.isIrrelevantText(text)) {
              console.log('LinkedIn Connect AI: Found about text with fallback selector:', textSelector);
              return text;
            }
          }
        }
      }
    }

    // Enhanced last resort: search for meaningful biographical text
    const allSpans = document.querySelectorAll('span[aria-hidden="true"]');
    const potentialBios = [];
    
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.length > 50 && text.length < 1000 && !this.isIrrelevantText(text)) {
        // Check if this span is in a reasonable location (not in header/footer)
        const rect = span.getBoundingClientRect();
        if (rect.top > 200 && rect.top < window.innerHeight - 200) {
          // Score the text based on biographical indicators
          const bioScore = this.calculateBioScore(text);
          if (bioScore > 3) {
            potentialBios.push({ text, score: bioScore });
          }
        }
      }
    }
    
    // Return the highest scoring bio text
    if (potentialBios.length > 0) {
      potentialBios.sort((a, b) => b.score - a.score);
      console.log('LinkedIn Connect AI: Found potential bio with scoring method');
      return potentialBios[0].text;
    }

    console.log('LinkedIn Connect AI: No about section found');
    return '';
  }

  // Helper function to identify irrelevant text
  isIrrelevantText(text) {
    const irrelevantPatterns = [
      /^\d+\s*(followers?|connections?)/i,
      /^(followers?|connections?)\s*\d+/i,
      /^(message|connect|follow)$/i,
      /^view\s+profile/i,
      /^see\s+more$/i,
      /^show\s+less$/i,
      /^\d+\s*years?\s*\d+\s*months?$/i,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      /^\d{4}\s*-\s*\d{4}$/i,
      /^present$/i,
      /^•$/,
      /^\.{3,}$/
    ];
    
    return irrelevantPatterns.some(pattern => pattern.test(text.toLowerCase()));
  }

  // Helper function to score biographical text
  calculateBioScore(text) {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Positive indicators
    const positiveWords = [
      'passionate', 'experienced', 'dedicated', 'focused', 'specialized',
      'expertise', 'professional', 'years', 'background', 'skills',
      'leading', 'managing', 'developing', 'creating', 'building',
      'helping', 'working', 'love', 'enjoy', 'enthusiastic'
    ];
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 1;
    });
    
    // First person indicators
    const firstPersonWords = ['i am', 'i have', 'i work', 'i love', 'my experience', 'my passion'];
    firstPersonWords.forEach(phrase => {
      if (lowerText.includes(phrase)) score += 2;
    });
    
    // Professional terms
    const professionalTerms = [
      'ceo', 'cto', 'manager', 'director', 'engineer', 'developer',
      'consultant', 'analyst', 'specialist', 'coordinator', 'lead'
    ];
    professionalTerms.forEach(term => {
      if (lowerText.includes(term)) score += 1;
    });
    
    return score;
  }

  getExperience() {
    console.log('LinkedIn Connect AI: Parsing experience section...');
    
    // Multiple selectors for experience entries
    const experienceSelectors = [
      '#experience ~ .pvs-list__paged-list-item',
      '#experience ~ .pvs-list .pvs-list__paged-list-item',
      'section[data-section="experience"] .pvs-list__paged-list-item',
      '.experience-section .pvs-list__paged-list-item',
      '.pv-profile-section[data-section="experience"] .pvs-list__paged-list-item'
    ];
    
    let experienceElements = [];
    for (const selector of experienceSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        experienceElements = elements;
        console.log(`LinkedIn Connect AI: Found ${elements.length} experience entries with selector: ${selector}`);
        break;
      }
    }
    
    const experiences = [];
    
    experienceElements.forEach((element, index) => {
      if (index >= 5) return; // Limit to top 5 experiences
      
      // Multiple selectors for job title
      const titleSelectors = [
        '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
        '.display-flex.align-items-center .mr1.t-bold span[aria-hidden="true"]',
        '.pv-entity__summary-info h3 span[aria-hidden="true"]',
        '.t-16.t-black.t-bold span[aria-hidden="true"]',
        'h3 .visually-hidden'
      ];
      
      let title = '';
      for (const titleSelector of titleSelectors) {
        const titleElement = element.querySelector(titleSelector);
        if (titleElement && titleElement.textContent.trim()) {
          title = titleElement.textContent.trim();
          break;
        }
      }
      
      // Multiple selectors for company
      const companySelectors = [
        '.t-14.t-normal span[aria-hidden="true"]',
        '.pv-entity__secondary-title span[aria-hidden="true"]',
        '.t-14.t-normal.break-words span[aria-hidden="true"]',
        '.inline-show-more-text .t-14 span[aria-hidden="true"]'
      ];
      
      let company = '';
      for (const companySelector of companySelectors) {
        const companyElements = element.querySelectorAll(companySelector);
        for (const companyElement of companyElements) {
          const text = companyElement.textContent.trim();
          // Skip duration text and look for actual company names
          if (text && !this.isDurationText(text) && !this.isLocationText(text)) {
            company = text;
            break;
          }
        }
        if (company) break;
      }
      
      // Multiple selectors for duration
      const durationSelectors = [
        '.pvs-entity__caption-wrapper span[aria-hidden="true"]',
        '.t-12.t-black--light span[aria-hidden="true"]',
        '.pv-entity__dates span[aria-hidden="true"]',
        '.t-black--light.t-12 span[aria-hidden="true"]'
      ];
      
      let duration = '';
      for (const durationSelector of durationSelectors) {
        const durationElement = element.querySelector(durationSelector);
        if (durationElement && durationElement.textContent.trim()) {
          const text = durationElement.textContent.trim();
          if (this.isDurationText(text)) {
            duration = text;
            break;
          }
        }
      }
      
      // Extract job description if available
      const descriptionSelectors = [
        '.inline-show-more-text--is-expanded span[aria-hidden="true"]',
        '.pv-shared-text-with-see-more span[aria-hidden="true"]',
        '.break-words span[aria-hidden="true"]:not(.t-14):not(.t-12)'
      ];
      
      let description = '';
      for (const descSelector of descriptionSelectors) {
        const descElement = element.querySelector(descSelector);
        if (descElement && descElement.textContent.trim().length > 50) {
          const text = descElement.textContent.trim();
          if (!this.isIrrelevantText(text) && !this.isDurationText(text)) {
            description = text.substring(0, 200) + (text.length > 200 ? '...' : '');
            break;
          }
        }
      }
      
      if (title) {
        experiences.push({ 
          title, 
          company: company || 'Company not specified', 
          duration: duration || 'Duration not specified',
          description: description || ''
        });
        console.log(`LinkedIn Connect AI: Parsed experience ${index + 1}: ${title} at ${company}`);
      }
    });
    
    console.log(`LinkedIn Connect AI: Found ${experiences.length} total experiences`);
    return experiences.slice(0, 3); // Return top 3 experiences
  }

  getEducation() {
    console.log('LinkedIn Connect AI: Parsing education section...');
    
    // Multiple selectors for education entries
    const educationSelectors = [
      '#education ~ .pvs-list__paged-list-item',
      '#education ~ .pvs-list .pvs-list__paged-list-item',
      'section[data-section="education"] .pvs-list__paged-list-item',
      '.education-section .pvs-list__paged-list-item',
      '.pv-profile-section[data-section="education"] .pvs-list__paged-list-item'
    ];
    
    let educationElements = [];
    for (const selector of educationSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        educationElements = elements;
        console.log(`LinkedIn Connect AI: Found ${elements.length} education entries with selector: ${selector}`);
        break;
      }
    }
    
    const education = [];
    
    educationElements.forEach((element, index) => {
      if (index >= 3) return; // Limit to top 3 education entries
      
      // Multiple selectors for school name
      const schoolSelectors = [
        '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
        '.display-flex.align-items-center .mr1.t-bold span[aria-hidden="true"]',
        '.pv-entity__school-name span[aria-hidden="true"]',
        'h3 .visually-hidden'
      ];
      
      let school = '';
      for (const schoolSelector of schoolSelectors) {
        const schoolElement = element.querySelector(schoolSelector);
        if (schoolElement && schoolElement.textContent.trim()) {
          school = schoolElement.textContent.trim();
          break;
        }
      }
      
      // Multiple selectors for degree
      const degreeSelectors = [
        '.t-14.t-normal span[aria-hidden="true"]',
        '.pv-entity__degree-name span[aria-hidden="true"]',
        '.pv-entity__fos span[aria-hidden="true"]',
        '.t-14.t-normal.break-words span[aria-hidden="true"]'
      ];
      
      let degree = '';
      for (const degreeSelector of degreeSelectors) {
        const degreeElement = element.querySelector(degreeSelector);
        if (degreeElement && degreeElement.textContent.trim()) {
          const text = degreeElement.textContent.trim();
          // Skip dates and other irrelevant text
          if (!this.isDurationText(text) && !this.isLocationText(text)) {
            degree = text;
            break;
          }
        }
      }
      
      // Extract graduation year if available
      const yearSelectors = [
        '.pvs-entity__caption-wrapper span[aria-hidden="true"]',
        '.t-12.t-black--light span[aria-hidden="true"]',
        '.pv-entity__dates span[aria-hidden="true"]'
      ];
      
      let year = '';
      for (const yearSelector of yearSelectors) {
        const yearElement = element.querySelector(yearSelector);
        if (yearElement && yearElement.textContent.trim()) {
          const text = yearElement.textContent.trim();
          if (this.isYearText(text)) {
            year = text;
            break;
          }
        }
      }
      
      if (school) {
        education.push({ 
          school, 
          degree: degree || 'Degree not specified',
          year: year || ''
        });
        console.log(`LinkedIn Connect AI: Parsed education ${index + 1}: ${degree} from ${school}`);
      }
    });
    
    console.log(`LinkedIn Connect AI: Found ${education.length} total education entries`);
    return education.slice(0, 2); // Return top 2 education entries
  }

  // Helper function to identify duration text
  isDurationText(text) {
    const durationPatterns = [
      /\d+\s*years?\s*\d*\s*months?/i,
      /\d{4}\s*[-–]\s*\d{4}/i,
      /\d{4}\s*[-–]\s*present/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i,
      /\d+\s*months?/i,
      /\d+\s*years?/i,
      /present/i
    ];
    
    return durationPatterns.some(pattern => pattern.test(text));
  }

  // Helper function to identify year text
  isYearText(text) {
    const yearPatterns = [
      /\d{4}/,
      /\d{4}\s*[-–]\s*\d{4}/,
      /\d{4}\s*[-–]\s*present/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i
    ];
    
    return yearPatterns.some(pattern => pattern.test(text));
  }

  // Helper function to identify location text
  isLocationText(text) {
    const locationPatterns = [
      /,\s*[A-Z]{2}$/i, // Ends with state abbreviation
      /,\s*[A-Za-z\s]+$/i, // Ends with location
      /(united states|usa|uk|canada|australia)/i,
      /(remote|hybrid)/i
    ];
    
    return locationPatterns.some(pattern => pattern.test(text));
  }

  getSkills() {
    const skillElements = document.querySelectorAll('#skills ~ .pvs-list .mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
    const skills = [];
    
    skillElements.forEach(element => {
      const skill = element.textContent.trim();
      if (skill) skills.push(skill);
    });
    
    return skills.slice(0, 10); // Get top 10 skills
  }

  injectAIButton() {
    // Remove existing button if present
    const existingButton = document.querySelector('#ai-connect-button');
    if (existingButton) {
      existingButton.remove();
    }

    // Create the AI button with fixed positioning in top right corner
    const aiButton = document.createElement('button');
    aiButton.id = 'ai-connect-button';
    aiButton.className = 'artdeco-button artdeco-button--2 artdeco-button--primary ai-connect-btn-fixed';
    aiButton.innerHTML = `
      <span class="artdeco-button__text">
        🤖 AI Connect
      </span>
    `;
    
    // Apply fixed positioning styles - top right corner
    aiButton.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: auto !important;
      right: 20px !important;
      z-index: 9999 !important;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
      border: none !important;
      color: white !important;
      font-weight: 500 !important;
      padding: 8px 16px !important;
      border-radius: 24px !important;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
      transition: all 0.3s ease !important;
      cursor: pointer !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      min-width: auto !important;
      height: auto !important;
      opacity: 0.9 !important;
    `;
    
    // Add hover effects
    aiButton.addEventListener('mouseenter', () => {
      aiButton.style.transform = 'translateY(-2px) scale(1.05)';
      aiButton.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
      aiButton.style.opacity = '1';
    });
    
    aiButton.addEventListener('mouseleave', () => {
      aiButton.style.transform = 'translateY(0) scale(1)';
      aiButton.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
      aiButton.style.opacity = '0.9';
    });
    
    aiButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleAIConnect();
    });

    // Insert the button into the page
    document.body.appendChild(aiButton);
    console.log('LinkedIn Connect AI: Fixed position button injected successfully at top right corner');
  }

  async handleAIConnect() {
    const button = document.querySelector('#ai-connect-button');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<span class="artdeco-button__text">🤖 Generating...</span>';
    button.disabled = true;

    try {
      // Send profile data to background script
      const response = await chrome.runtime.sendMessage({
        action: 'generateMessage',
        profileData: this.profileData
      });

      if (response.success) {
        this.showMessageModal(response.message);
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      console.error('Error generating message:', error);
      this.showError('Failed to generate message. Please try again.');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  showMessageModal(message) {
    // Remove existing modal if present
    const existingModal = document.querySelector('#ai-message-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'ai-message-modal';
    modal.className = 'ai-modal-overlay';
    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <h3>AI Generated Connection Message</h3>
          <button class="ai-modal-close">&times;</button>
        </div>
        <div class="ai-modal-body">
          <textarea class="ai-message-textarea" rows="6">${message}</textarea>
          <div class="ai-modal-actions">
            <button class="ai-btn ai-btn-secondary" id="copy-message">Copy Message</button>
            <button class="ai-btn ai-btn-primary" id="send-connect">Send Connect Request</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#copy-message').addEventListener('click', () => {
      const textarea = modal.querySelector('.ai-message-textarea');
      textarea.select();
      document.execCommand('copy');
      
      const copyBtn = modal.querySelector('#copy-message');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });

    modal.querySelector('#send-connect').addEventListener('click', () => {
      const customMessage = modal.querySelector('.ai-message-textarea').value;
      this.sendConnectionRequest(customMessage);
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  sendConnectionRequest(message) {
    // Click the original LinkedIn connect button and attempt to add the message
    const connectButton = document.querySelector('button[aria-label*="Connect"]') ||
                         document.querySelector('button[aria-label*="Invite"]') ||
                         document.querySelector('.artdeco-button--primary[aria-label*="Connect"]');
    
    if (connectButton) {
      connectButton.click();
      
      // Wait for the modal to appear and inject the message
      setTimeout(() => {
        const messageTextarea = document.querySelector('textarea[name="message"]') ||
                               document.querySelector('#custom-message') ||
                               document.querySelector('textarea[id*="message"]') ||
                               document.querySelector('.connect-button-send-invite__custom-message textarea');
        
        if (messageTextarea) {
          messageTextarea.value = message;
          messageTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          messageTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 1000);
    } else {
      // Fallback: just copy the message to clipboard
      navigator.clipboard.writeText(message).then(() => {
        this.showSuccessMessage('Message copied to clipboard! Use it when sending your connection request.');
      });
    }
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'ai-success-message';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 4000);
  }

  showError(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'ai-error-message';
    errorDiv.textContent = errorMessage;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  observePageChanges() {
    // Observe DOM mutations to re-parse when new content is inserted
    this.pageObserver = new MutationObserver((mutations) => {
      const hasSignificantChanges = mutations.some(mutation => 
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );
      if (hasSignificantChanges && this.isProfilePage()) {
        const now = Date.now();
        if (now - this.lastParseAt > 5000) {
          this.lastParseAt = now;
          setTimeout(async () => {
            await this.parseProfile();
            this.injectAIButton();
          }, 500);
        }
      }
    });

    this.pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Attempt to fetch profile details via LinkedIn's internal Voyager API.
   * This call relies on the user being authenticated (cookies present).
   */
  async fetchVoyagerProfile() {
    try {
      const publicId = window.location.pathname.split('/in/')[1]?.split('/')[0];
      if (!publicId) return null;

      const csrf = this.getCsrfToken();
      if (!csrf) {
        console.warn('LinkedIn Connect AI: Unable to determine CSRF token for Voyager request');
        return null;
      }

      const voyagerUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/profileView`;

      const resp = await fetch(voyagerUrl, {
        credentials: 'include',
        headers: {
          'accept': 'application/json',
          'csrf-token': csrf,
          'x-restli-protocol-version': '2.0.0'
        }
      });

      if (!resp.ok) {
        console.warn('LinkedIn Connect AI: Voyager request failed with status', resp.status);
        return null;
      }

      const data = await resp.json();
      return data;
    } catch (err) {
      console.error('LinkedIn Connect AI: Voyager fetch failed', err);
      return null;
    }
  }

  getCsrfToken() {
    const match = document.cookie.match(/JSESSIONID\s*=\s*"?([^";]+)/);
    // The cookie value already contains the required "ajax:" prefix (if any).
    return match ? match[1] : '';
  }

  extractSummaryFromVoyager(vData) {
    try {
      return vData?.profileSummary?.text?.text || vData?.summary || '';
    } catch {
      return '';
    }
  }

  extractExperienceFromVoyager(vData) {
    const list = [];
    const positions = vData?.positionView?.elements || [];
    positions.slice(0, 3).forEach(pos => {
      list.push({
        title: pos?.title || '',
        company: pos?.companyName || pos?.company?.name || 'Company not specified',
        duration: this.formatVoyagerDuration(pos?.timePeriod) || 'Duration not specified',
        description: pos?.description || ''
      });
    });
    return list;
  }

  formatVoyagerDuration(tp) {
    if (!tp || !tp.startDate) return '';
    const monthNames = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const start = `${monthNames[tp.startDate.month || 1]} ${tp.startDate.year}`;
    const end = tp.endDate ? `${monthNames[tp.endDate.month || 1]} ${tp.endDate.year}` : 'Present';
    return `${start} – ${end}`;
  }

  extractEducationFromVoyager(vData) {
    try {
      const list = [];
      const educations = vData?.educationView?.elements || vData?.educations || [];
      educations.slice(0, 3).forEach(ed => {
        const degreeParts = [];
        if (ed.degreeName) degreeParts.push(ed.degreeName);
        if (ed.fieldOfStudy) degreeParts.push(ed.fieldOfStudy);
        const degree = degreeParts.join(', ');
        const year = ed.timePeriod ? this.formatVoyagerDuration(ed.timePeriod) : '';
        list.push({
          school: ed.schoolName || ed.school?.name || 'School not specified',
          degree: degree || 'Degree not specified',
          year: year
        });
      });
      return list;
    } catch {
      return [];
    }
  }
}

// --- Initialization & SPA routing support ---

function initLinkedInParser(force = false) {
  const isProfile = window.location.pathname.startsWith('/in/');
  if (!isProfile) return;

  // Use a global flag to avoid spawning multiple parsers for same URL
  const currentUrl = window.location.pathname;
  if (!force && window.__aiLastProfileUrl === currentUrl) {
    return;
  }

  window.__aiLastProfileUrl = currentUrl;
  new LinkedInProfileParser();
}

// Backup observer: detect DOM insertions that include a profile heading and trigger parse if needed
const urlDomObserver = new MutationObserver(() => {
  if (window.location.pathname.startsWith('/in/')) {
    initLinkedInParser();
  }
});

urlDomObserver.observe(document.body, { childList: true, subtree: true });

// Run on initial page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinkedInParser);
} else {
  initLinkedInParser();
}

// Hook into History API to detect SPA navigations
(function(history) {
  const push = history.pushState;
  const replace = history.replaceState;
  function fire() {
    window.dispatchEvent(new Event('locationchange'));
  }
  history.pushState = function() {
    const ret = push.apply(this, arguments);
    fire();
    return ret;
  };
  history.replaceState = function() {
    const ret = replace.apply(this, arguments);
    fire();
    return ret;
  };
})(window.history);

window.addEventListener('popstate', () => {
  window.dispatchEvent(new Event('locationchange'));
});

// Re-initialize parser on every location change
window.addEventListener('locationchange', () => {
  setTimeout(() => {
    initLinkedInParser();
  }, 1500); // small delay to allow new content load
}); 