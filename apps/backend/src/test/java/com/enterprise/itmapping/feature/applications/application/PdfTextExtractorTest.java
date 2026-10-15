package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PdfTextExtractorTest {

  private final PdfTextExtractor extractor = new PdfTextExtractor();

  @Test
  void storesTheTextLayerOfAPdf() throws IOException {
    String text = extractor.extract(pdfWithText("Service B exposes an API."));

    assertThat(text).contains("Service B exposes an API.");
  }

  @Test
  void refusesAPdfWithNoTextLayer() {
    assertThatThrownBy(() -> extractor.extract(blankPdf()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("no extractable text");
  }

  @Test
  void refusesAPasswordProtectedPdf() {
    assertThatThrownBy(() -> extractor.extract(lockedPdf()))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Password-protected PDF");
  }

  @Test
  void refusesAnUnreadablePdf() {
    assertThatThrownBy(() -> extractor.extract(new byte[] {1, 2, 3}))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Unreadable PDF");
  }

  private static byte[] pdfWithText(String sentence) throws IOException {
    try (PDDocument document = new PDDocument()) {
      PDPage page = new PDPage();
      document.addPage(page);
      try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
        stream.beginText();
        stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        stream.newLineAtOffset(50, 700);
        stream.showText(sentence);
        stream.endText();
      }
      return save(document);
    }
  }

  private static byte[] blankPdf() throws IOException {
    try (PDDocument document = new PDDocument()) {
      document.addPage(new PDPage());
      return save(document);
    }
  }

  private static byte[] lockedPdf() throws IOException {
    try (PDDocument document = new PDDocument()) {
      document.addPage(new PDPage());
      AccessPermission permission = new AccessPermission();
      StandardProtectionPolicy policy =
          new StandardProtectionPolicy("owner-secret", "user-secret", permission);
      policy.setEncryptionKeyLength(128);
      document.protect(policy);
      return save(document);
    }
  }

  private static byte[] save(PDDocument document) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    document.save(out);
    return out.toByteArray();
  }
}
