import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';

// Simmonds brand colors
const COLORS = {
  primary: '003F37',      // Teal
  olive: '4F5338',        // Dark olive
  lime: '9F9D38',         // Lime/olive accent
  terracotta: 'B25627',   // Terracotta
  cream: 'E3C6AB',        // Cream
  white: 'FFFFFF',
  charcoal: '333333',
};

interface LessonSection {
  id: string;
  type: 'introduction' | 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'exercise' | 'summary';
  title: string;
  content: string;
  visualContent?: string;
  order: number;
}

interface VocabularyItem {
  word: string;
  definition: string;
  example: string;
  partOfSpeech?: string;
}

interface GrammarPoint {
  rule: string;
  explanation: string;
  examples: string[];
}

interface LessonData {
  title: string;
  description: string;
  level: string;
  objectives?: string[];
  sections: LessonSection[];
  vocabulary?: VocabularyItem[];
  grammarPoints?: GrammarPoint[];
}

// Helper to strip HTML tags and decode entities
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Helper to extract text content from HTML, preserving some structure
function extractTextFromHtml(html: string): string[] {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const lines: string[] = [];

  // Get all text nodes and block elements
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let currentLine = '';

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        currentLine += text + ' ';
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName.toLowerCase();
      if (['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'tr'].includes(tagName)) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
      }
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.filter(line => line.length > 0);
}

/**
 * Export lesson to PowerPoint (.pptx) file
 */
export async function exportToPowerPoint(lesson: LessonData, companyName?: string): Promise<void> {
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.author = companyName || 'Simmonds Language Services';
  pptx.title = lesson.title;
  pptx.subject = `${lesson.level} - ${lesson.description}`;
  pptx.company = companyName || 'Simmonds Language Services';

  // Define master slide layout
  pptx.defineSlideMaster({
    title: 'SIMMONDS_MASTER',
    background: { color: COLORS.white },
    objects: [
      // Footer bar
      {
        rect: {
          x: 0,
          y: 5.2,
          w: '100%',
          h: 0.3,
          fill: { color: COLORS.cream },
        },
      },
      // Footer text
      {
        text: {
          text: companyName || 'Simmonds Language Services',
          options: {
            x: 0.3,
            y: 5.25,
            w: 5,
            h: 0.2,
            fontSize: 8,
            color: COLORS.olive,
          },
        },
      },
    ],
  });

  // Title Slide
  const titleSlide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

  // Title background gradient (simulated with rectangle)
  titleSlide.addShape('rect', {
    x: 0,
    y: 1.5,
    w: '100%',
    h: 2,
    fill: { color: COLORS.primary },
  });

  // Lesson title
  titleSlide.addText(lesson.title, {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 1,
    fontSize: 36,
    fontFace: 'Arial',
    color: COLORS.white,
    bold: true,
    align: 'center',
  });

  // Level and description
  titleSlide.addText(`Level: ${lesson.level}`, {
    x: 0.5,
    y: 2.8,
    w: 9,
    h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.cream,
    align: 'center',
  });

  titleSlide.addText(lesson.description, {
    x: 0.5,
    y: 3.8,
    w: 9,
    h: 0.8,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.charcoal,
    align: 'center',
  });

  // Objectives slide (if available)
  if (lesson.objectives && lesson.objectives.length > 0) {
    const objectivesSlide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

    // Header
    objectivesSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: COLORS.primary },
    });

    objectivesSlide.addText('Learning Objectives', {
      x: 0.3,
      y: 0.2,
      w: 9,
      h: 0.5,
      fontSize: 24,
      fontFace: 'Arial',
      color: COLORS.white,
      bold: true,
    });

    // Objectives list
    const objectivesList = lesson.objectives.map((obj, i) => ({
      text: `${i + 1}. ${obj}`,
      options: { bullet: false, fontSize: 16, color: COLORS.charcoal },
    }));

    objectivesSlide.addText(objectivesList, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 3.5,
      fontFace: 'Arial',
      valign: 'top',
      paraSpaceAfter: 12,
    });
  }

  // Content slides for each section
  for (const section of lesson.sections) {
    const slide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

    // Section header
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: COLORS.primary },
    });

    // Section type badge
    slide.addShape('roundRect', {
      x: 0.3,
      y: 0.15,
      w: 1.2,
      h: 0.35,
      fill: { color: COLORS.lime },
      rectRadius: 0.1,
    });

    slide.addText(section.type.toUpperCase(), {
      x: 0.3,
      y: 0.15,
      w: 1.2,
      h: 0.35,
      fontSize: 10,
      fontFace: 'Arial',
      color: COLORS.white,
      bold: true,
      align: 'center',
      valign: 'middle',
    });

    // Section title
    slide.addText(section.title, {
      x: 1.7,
      y: 0.2,
      w: 7.5,
      h: 0.5,
      fontSize: 22,
      fontFace: 'Arial',
      color: COLORS.white,
      bold: true,
    });

    // Section content
    const contentHtml = section.visualContent || section.content;
    const contentLines = extractTextFromHtml(contentHtml);

    // Create text array for bullet points
    const textItems = contentLines.slice(0, 10).map(line => ({
      text: line.substring(0, 200), // Limit line length
      options: {
        bullet: line.length < 150,
        fontSize: 14,
        color: COLORS.charcoal,
        breakLine: true,
      },
    }));

    if (textItems.length > 0) {
      slide.addText(textItems, {
        x: 0.5,
        y: 1.0,
        w: 9,
        h: 4,
        fontFace: 'Arial',
        valign: 'top',
        paraSpaceAfter: 8,
      });
    }
  }

  // Vocabulary slide (if available)
  if (lesson.vocabulary && lesson.vocabulary.length > 0) {
    const vocabSlide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

    vocabSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: COLORS.olive },
    });

    vocabSlide.addText('📚 Key Vocabulary', {
      x: 0.3,
      y: 0.2,
      w: 9,
      h: 0.5,
      fontSize: 24,
      fontFace: 'Arial',
      color: COLORS.white,
      bold: true,
    });

    // Create vocabulary table
    const vocabRows: any[][] = [
      [
        { text: 'Word', options: { bold: true, fill: { color: COLORS.primary }, color: COLORS.white } },
        { text: 'Definition', options: { bold: true, fill: { color: COLORS.primary }, color: COLORS.white } },
        { text: 'Example', options: { bold: true, fill: { color: COLORS.primary }, color: COLORS.white } },
      ],
    ];

    lesson.vocabulary.slice(0, 6).forEach(vocab => {
      vocabRows.push([
        { text: vocab.word, options: { bold: true, color: COLORS.primary } },
        { text: vocab.definition, options: { color: COLORS.charcoal } },
        { text: vocab.example, options: { italic: true, color: COLORS.olive } },
      ]);
    });

    vocabSlide.addTable(vocabRows, {
      x: 0.3,
      y: 1.0,
      w: 9.4,
      colW: [2, 3.5, 3.9],
      fontFace: 'Arial',
      fontSize: 11,
      border: { type: 'solid', color: COLORS.cream, pt: 1 },
      rowH: 0.5,
    });
  }

  // Grammar slide (if available)
  if (lesson.grammarPoints && lesson.grammarPoints.length > 0) {
    const grammarSlide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

    grammarSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.8,
      fill: { color: COLORS.terracotta },
    });

    grammarSlide.addText('📖 Grammar Focus', {
      x: 0.3,
      y: 0.2,
      w: 9,
      h: 0.5,
      fontSize: 24,
      fontFace: 'Arial',
      color: COLORS.white,
      bold: true,
    });

    let yPos = 1.0;
    lesson.grammarPoints.slice(0, 2).forEach(point => {
      // Rule box
      grammarSlide.addShape('rect', {
        x: 0.3,
        y: yPos,
        w: 9.4,
        h: 0.5,
        fill: { color: COLORS.cream },
      });

      grammarSlide.addText(point.rule, {
        x: 0.5,
        y: yPos + 0.1,
        w: 9,
        h: 0.35,
        fontSize: 14,
        fontFace: 'Arial',
        color: COLORS.primary,
        bold: true,
      });

      yPos += 0.6;

      // Explanation
      grammarSlide.addText(point.explanation, {
        x: 0.5,
        y: yPos,
        w: 9,
        h: 0.4,
        fontSize: 12,
        fontFace: 'Arial',
        color: COLORS.charcoal,
      });

      yPos += 0.5;

      // Examples
      if (point.examples && point.examples.length > 0) {
        point.examples.slice(0, 3).forEach(example => {
          grammarSlide.addText(`• ${example}`, {
            x: 0.7,
            y: yPos,
            w: 8.8,
            h: 0.3,
            fontSize: 11,
            fontFace: 'Arial',
            color: COLORS.olive,
            italic: true,
          });
          yPos += 0.35;
        });
      }

      yPos += 0.3;
    });
  }

  // Summary/Thank you slide
  const endSlide = pptx.addSlide({ masterName: 'SIMMONDS_MASTER' });

  endSlide.addShape('rect', {
    x: 0,
    y: 1.8,
    w: '100%',
    h: 1.5,
    fill: { color: COLORS.primary },
  });

  endSlide.addText('Great Work! 🎉', {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 0.8,
    fontSize: 32,
    fontFace: 'Arial',
    color: COLORS.white,
    bold: true,
    align: 'center',
  });

  endSlide.addText('Keep practicing to master these concepts!', {
    x: 0.5,
    y: 2.8,
    w: 9,
    h: 0.4,
    fontSize: 16,
    fontFace: 'Arial',
    color: COLORS.cream,
    align: 'center',
  });

  endSlide.addText(companyName || 'Simmonds Language Services', {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.olive,
    align: 'center',
  });

  // Generate and download
  await pptx.writeFile({ fileName: `${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}_Lesson.pptx` });
}

/**
 * Export lesson to PDF worksheet
 */
export async function exportToPDF(lesson: LessonData, companyName?: string): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper to draw header on each page
  const drawHeader = () => {
    pdf.setFillColor(0, 63, 55); // Primary teal
    pdf.rect(0, 0, pageWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(lesson.title, margin, 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Level: ${lesson.level}`, pageWidth - margin - 30, 13);
    yPos = 30;
  };

  // Helper to draw footer
  const drawFooter = (pageNum: number, totalPages: number) => {
    pdf.setFillColor(227, 198, 171); // Cream
    pdf.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    pdf.setTextColor(79, 83, 56); // Olive
    pdf.setFontSize(8);
    pdf.text(companyName || 'Simmonds Language Services', margin, pageHeight - 5);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 5);
  };

  // Title Page
  pdf.setFillColor(0, 63, 55);
  pdf.rect(0, 0, pageWidth, 80, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(lesson.title, contentWidth);
  pdf.text(titleLines, pageWidth / 2, 35, { align: 'center' });

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Level: ${lesson.level}`, pageWidth / 2, 55, { align: 'center' });

  pdf.setTextColor(227, 198, 171);
  pdf.setFontSize(12);
  const descLines = pdf.splitTextToSize(lesson.description, contentWidth - 20);
  pdf.text(descLines, pageWidth / 2, 68, { align: 'center' });

  yPos = 95;

  // Objectives
  if (lesson.objectives && lesson.objectives.length > 0) {
    pdf.setTextColor(0, 63, 55);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Learning Objectives', margin, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 51, 51);

    lesson.objectives.forEach((obj, i) => {
      checkPageBreak(8);
      pdf.text(`${i + 1}. ${obj}`, margin + 5, yPos);
      yPos += 7;
    });

    yPos += 10;
  }

  // Sections
  for (const section of lesson.sections) {
    checkPageBreak(40);

    // Section header
    pdf.setFillColor(0, 63, 55);
    pdf.rect(margin, yPos, contentWidth, 10, 'F');

    // Type badge
    pdf.setFillColor(159, 157, 56); // Lime
    pdf.roundedRect(margin + 2, yPos + 2, 25, 6, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.type.toUpperCase(), margin + 14.5, yPos + 6, { align: 'center' });

    // Section title
    pdf.setFontSize(12);
    pdf.text(section.title, margin + 30, yPos + 7);

    yPos += 15;

    // Section content
    const contentHtml = section.visualContent || section.content;
    const contentText = stripHtml(contentHtml);

    pdf.setTextColor(51, 51, 51);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lines = pdf.splitTextToSize(contentText, contentWidth - 10);
    for (const line of lines.slice(0, 20)) { // Limit lines
      checkPageBreak(6);
      pdf.text(line, margin + 5, yPos);
      yPos += 5;
    }

    yPos += 8;
  }

  // Vocabulary section
  if (lesson.vocabulary && lesson.vocabulary.length > 0) {
    pdf.addPage();
    yPos = margin;

    pdf.setFillColor(79, 83, 56); // Olive
    pdf.rect(0, 0, pageWidth, 15, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('📚 Key Vocabulary', margin, 10);

    yPos = 25;

    lesson.vocabulary.forEach((vocab, i) => {
      checkPageBreak(25);

      // Vocab card
      pdf.setFillColor(250, 250, 248);
      pdf.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
      pdf.setDrawColor(227, 198, 171);
      pdf.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'S');

      // Word
      pdf.setTextColor(0, 63, 55);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(vocab.word, margin + 5, yPos + 7);

      // Part of speech
      if (vocab.partOfSpeech) {
        pdf.setFontSize(8);
        pdf.setTextColor(159, 157, 56);
        pdf.text(`(${vocab.partOfSpeech})`, margin + 5 + pdf.getTextWidth(vocab.word) + 3, yPos + 7);
      }

      // Definition
      pdf.setTextColor(51, 51, 51);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(vocab.definition, margin + 5, yPos + 13);

      // Example
      pdf.setTextColor(79, 83, 56);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      const exampleText = `"${vocab.example}"`;
      const exampleLines = pdf.splitTextToSize(exampleText, contentWidth - 15);
      pdf.text(exampleLines[0], margin + 5, yPos + 18);

      yPos += 25;
    });
  }

  // Grammar section
  if (lesson.grammarPoints && lesson.grammarPoints.length > 0) {
    checkPageBreak(60);

    if (yPos > 50) {
      pdf.addPage();
      yPos = margin;
    }

    pdf.setFillColor(178, 86, 39); // Terracotta
    pdf.rect(0, yPos - margin, pageWidth, 15, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('📖 Grammar Focus', margin, yPos - margin + 10);

    yPos += 5;

    lesson.grammarPoints.forEach(point => {
      checkPageBreak(40);

      // Rule box
      pdf.setFillColor(227, 198, 171);
      pdf.rect(margin, yPos, contentWidth, 8, 'F');
      pdf.setTextColor(0, 63, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(point.rule, margin + 3, yPos + 5.5);

      yPos += 12;

      // Explanation
      pdf.setTextColor(51, 51, 51);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const explLines = pdf.splitTextToSize(point.explanation, contentWidth - 10);
      pdf.text(explLines, margin + 3, yPos);
      yPos += explLines.length * 5 + 3;

      // Examples
      if (point.examples && point.examples.length > 0) {
        pdf.setTextColor(79, 83, 56);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        point.examples.slice(0, 4).forEach(example => {
          checkPageBreak(6);
          pdf.text(`• ${example}`, margin + 8, yPos);
          yPos += 5;
        });
      }

      yPos += 8;
    });
  }

  // Add page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(i, totalPages);
  }

  // Save
  pdf.save(`${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}_Worksheet.pdf`);
}
