package com.enterprise.itmapping.feature.applications.application;

import java.io.IOException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Reads the text layer of a PDF. A scan with no text layer is refused. */
@Component
public class PdfTextExtractor {

  public String extract(byte[] pdf) {
    if (pdf == null || pdf.length == 0) {
      throw rejected("Unreadable PDF.");
    }
    try (PDDocument document = Loader.loadPDF(pdf)) {
      String text = new PDFTextStripper().getText(document);
      if (!StringUtils.hasText(text)) {
        throw rejected("PDF has no extractable text.");
      }
      return text;
    } catch (ResponseStatusException e) {
      throw e;
    } catch (InvalidPasswordException e) {
      throw rejected("Password-protected PDF.");
    } catch (IOException e) {
      throw rejected("Unreadable PDF.");
    }
  }

  private static ResponseStatusException rejected(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
