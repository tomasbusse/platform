// Professional PowerPoint-style slide templates for lesson presentations
// Each template uses inline styles for consistent rendering

interface SlideData {
  title: string;
  content: string;
  audioScript?: string;
  imageUrl?: string;
  type: string;
}

// Brand colors
const colors = {
  primary: '#003F37',      // Deep teal
  olive: '#4F5338',        // Olive
  lime: '#9F9D38',         // Lime accent
  terracotta: '#B25627',   // Terracotta accent
  cream: '#E3C6AB',        // Cream background
  white: '#FFFFFF',
  charcoal: '#333333',
  stone: '#666666',
};

// Common styles
const baseSlideStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  min-height: 100%;
  padding: 0;
`;

const headerStyle = `
  background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.olive} 100%);
  color: white;
  padding: 24px 32px;
  margin: 0;
`;

const contentStyle = `
  padding: 32px;
`;

const cardStyle = `
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  padding: 24px;
  margin-bottom: 20px;
`;

// Helper to extract content parts from HTML
function extractTextContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to extract list items from content
function extractListItems(html: string): string[] {
  const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
  return liMatches.map(li => li.replace(/<[^>]*>/g, '').trim());
}

// Image placeholder or actual image
function getImageHtml(imageUrl?: string, description?: string): string {
  if (imageUrl) {
    return `
      <div style="margin: 20px 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <img src="${imageUrl}" alt="${description || 'Lesson image'}" style="width: 100%; height: 200px; object-fit: cover; display: block;" />
      </div>
    `;
  }
  return `
    <div style="background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.lime} 100%); height: 180px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; margin: 20px 0;">
      <span style="font-size: 48px; opacity: 0.5;">🖼️</span>
    </div>
  `;
}

// Audio indicator
function getAudioIndicator(hasAudio: boolean = true): string {
  return hasAudio ? `
    <div style="display: flex; align-items: center; gap: 8px; color: ${colors.primary}; font-size: 14px; margin-top: 16px;">
      <span style="font-size: 18px;">🔊</span>
      <span>Audio available - click Listen in header</span>
    </div>
  ` : '';
}

// ============================================
// SLIDE TEMPLATES
// ============================================

export function introductionSlide(data: SlideData): string {
  const items = extractListItems(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle} text-align: center; padding: 40px 32px;">
        <h1 style="font-size: 36px; font-weight: 700; margin: 0 0 8px 0;">${data.title}</h1>
        <p style="font-size: 16px; opacity: 0.8; margin: 0;">Let's begin your learning journey</p>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle}">
          <h2 style="font-size: 22px; color: ${colors.primary}; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 28px;">🎯</span> Today you will learn:
          </h2>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${items.map((item, i) => `
              <li style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="background: ${colors.lime}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0;">${i + 1}</span>
                <span style="font-size: 18px; color: ${colors.charcoal}; line-height: 1.5;">${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>
        ${getImageHtml(data.imageUrl, data.title)}
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function vocabularySlide(data: SlideData): string {
  // Parse vocabulary items from content
  const vocabItems = data.content.match(/<strong>([^<]+)<\/strong>\s*[-–]\s*([^<]+)/gi) || [];
  const parsedVocab = vocabItems.map(item => {
    const match = item.match(/<strong>([^<]+)<\/strong>\s*[-–]\s*(.+)/i);
    return match ? { word: match[1], definition: match[2] } : null;
  }).filter(Boolean);

  // Fallback: extract from divs
  if (parsedVocab.length === 0) {
    const text = extractTextContent(data.content);
    const words = text.split(/[,;]/).map(w => w.trim()).filter(w => w.includes('-'));
    parsedVocab.push(...words.map(w => {
      const [word, def] = w.split('-').map(s => s.trim());
      return { word, definition: def || '' };
    }));
  }

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">📚</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${parsedVocab.slice(0, 8).map((v: any, i) => `
            <div style="${cardStyle} margin-bottom: 0; border-left: 4px solid ${i % 2 === 0 ? colors.lime : colors.terracotta};">
              <div style="font-size: 22px; font-weight: 700; color: ${colors.primary}; margin-bottom: 8px;">${v.word}</div>
              <div style="font-size: 16px; color: ${colors.stone}; line-height: 1.5;">${v.definition}</div>
            </div>
          `).join('')}
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function listeningSlide(data: SlideData): string {
  const questions = extractListItems(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">🎧</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="background: ${colors.primary}; color: white; padding: 24px 32px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🎧</div>
          <div style="font-size: 20px; font-weight: 600;">Click "Listen" to hear the dialogue</div>
          <div style="font-size: 14px; opacity: 0.8; margin-top: 8px;">Listen carefully and answer the questions below</div>
        </div>

        <div style="${cardStyle}">
          <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 16px 0;">While you listen, answer:</h3>
          <ol style="padding-left: 24px; margin: 0;">
            ${questions.map(q => `
              <li style="font-size: 18px; color: ${colors.charcoal}; padding: 10px 0; line-height: 1.5;">${q}</li>
            `).join('')}
          </ol>
        </div>
        ${getImageHtml(data.imageUrl, 'Listening context')}
      </div>
    </div>
  `;
}

export function comprehensionSlide(data: SlideData): string {
  const content = extractTextContent(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">✅</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle} border-left: 4px solid ${colors.lime};">
          <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 16px 0;">Answers</h3>
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;" innerHTML="${data.content}">
            ${data.content}
          </div>
        </div>

        <div style="background: ${colors.cream}; border-radius: 16px; padding: 24px; border: 2px solid ${colors.terracotta};">
          <h3 style="font-size: 18px; color: ${colors.terracotta}; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <span>💡</span> Useful Phrases
          </h3>
          <p style="font-size: 16px; color: ${colors.charcoal}; margin: 0; line-height: 1.6;">
            Practice repeating these key expressions from the dialogue.
          </p>
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function grammarSlide(data: SlideData): string {
  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">📐</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle} border-left: 4px solid ${colors.primary};">
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;">
            ${data.content}
          </div>
        </div>
        ${getImageHtml(data.imageUrl, 'Grammar illustration')}
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function expressionsSlide(data: SlideData): string {
  const items = extractListItems(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">💬</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${items.map((item, i) => `
            <div style="${cardStyle} margin-bottom: 0; display: flex; align-items: center; gap: 16px;">
              <span style="background: ${colors.primary}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">${i + 1}</span>
              <span style="font-size: 18px; color: ${colors.charcoal}; font-weight: 500;">"${item}"</span>
            </div>
          `).join('')}
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function exerciseSlide(data: SlideData): string {
  const items = extractListItems(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">✏️</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle}">
          <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 20px 0;">Complete the sentences:</h3>
          <ol style="padding-left: 24px; margin: 0;">
            ${items.map(item => `
              <li style="font-size: 18px; color: ${colors.charcoal}; padding: 14px 0; border-bottom: 1px solid #f0f0f0; line-height: 1.6;">${item.replace(/_+/g, '<span style="display: inline-block; min-width: 100px; border-bottom: 2px solid ' + colors.primary + '; margin: 0 4px;"></span>')}</li>
            `).join('')}
          </ol>
        </div>
        ${getImageHtml(data.imageUrl, 'Exercise context')}
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function speakingSlide(data: SlideData): string {
  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">🗣️</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="${cardStyle} margin-bottom: 0; border-top: 4px solid ${colors.primary};">
            <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 12px 0;">👤 Role A</h3>
            <p style="font-size: 16px; color: ${colors.charcoal}; line-height: 1.6; margin: 0;">
              Follow the prompts and practice your part of the conversation.
            </p>
          </div>
          <div style="${cardStyle} margin-bottom: 0; border-top: 4px solid ${colors.terracotta};">
            <h3 style="font-size: 18px; color: ${colors.terracotta}; margin: 0 0 12px 0;">👤 Role B</h3>
            <p style="font-size: 16px; color: ${colors.charcoal}; line-height: 1.6; margin: 0;">
              Respond naturally using the expressions you've learned.
            </p>
          </div>
        </div>

        <div style="${cardStyle} margin-top: 20px;">
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;">
            ${data.content}
          </div>
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function culturalSlide(data: SlideData): string {
  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">🌍</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle} border-left: 4px solid ${colors.terracotta};">
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;">
            ${data.content}
          </div>
        </div>
        ${getImageHtml(data.imageUrl, 'Cultural context')}

        <div style="background: ${colors.cream}; border-radius: 16px; padding: 20px; margin-top: 20px;">
          <p style="font-size: 15px; color: ${colors.stone}; margin: 0; font-style: italic; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">💡</span>
            Understanding culture helps you communicate more naturally!
          </p>
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function summarySlide(data: SlideData): string {
  const items = extractListItems(data.content);

  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle} text-align: center;">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0;">
          <span style="font-size: 32px;">🎉</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle}">
          <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 16px 0;">Today you learned:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${items.map(item => `
              <li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: ${colors.lime}; font-size: 20px;">✓</span>
                <span style="font-size: 17px; color: ${colors.charcoal};">${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div style="background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.olive} 100%); color: white; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 8px;">🌟 Great work!</div>
          <div style="font-size: 16px; opacity: 0.9;">You're making excellent progress!</div>
        </div>
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

export function homeworkSlide(data: SlideData): string {
  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">📝</span> ${data.title}
        </h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle} border-left: 4px solid ${colors.terracotta};">
          <h3 style="font-size: 18px; color: ${colors.terracotta}; margin: 0 0 16px 0;">Your Task</h3>
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;">
            ${data.content}
          </div>
        </div>

        <div style="${cardStyle} background: ${colors.cream};">
          <h3 style="font-size: 18px; color: ${colors.primary}; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <span>🔮</span> Coming Next
          </h3>
          <p style="font-size: 16px; color: ${colors.charcoal}; margin: 0;">
            Stay tuned for more exciting lessons!
          </p>
        </div>
        ${getImageHtml(data.imageUrl, 'Next lesson preview')}
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

// Default/reading slide template
export function defaultSlide(data: SlideData): string {
  return `
    <div style="${baseSlideStyle}">
      <div style="${headerStyle}">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0;">${data.title}</h1>
      </div>
      <div style="${contentStyle}">
        <div style="${cardStyle}">
          <div style="font-size: 17px; color: ${colors.charcoal}; line-height: 1.8;">
            ${data.content}
          </div>
        </div>
        ${getImageHtml(data.imageUrl, data.title)}
        ${getAudioIndicator(!!data.audioScript)}
      </div>
    </div>
  `;
}

// Main function to get template for slide type
export function getSlideTemplate(data: SlideData): string {
  const templates: Record<string, (data: SlideData) => string> = {
    introduction: introductionSlide,
    vocabulary: vocabularySlide,
    listening: listeningSlide,
    comprehension: comprehensionSlide,
    grammar: grammarSlide,
    expressions: expressionsSlide,
    exercise: exerciseSlide,
    speaking: speakingSlide,
    cultural: culturalSlide,
    summary: summarySlide,
    homework: homeworkSlide,
    reading: defaultSlide,
  };

  const template = templates[data.type] || defaultSlide;
  return template(data);
}
