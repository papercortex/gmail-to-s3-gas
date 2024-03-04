var PRESIGNER_URL =
  "https://38ansazw50.execute-api.us-east-1.amazonaws.com/presigned-s3-url";

function checkForRemarkableEmails() {
  var threads = GmailApp.search("from:my@remarkable.com newer_than:1d");
  Logger.log("Found threads: " + threads.length);

  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    messages.forEach(processMessage);
  });
}

function processMessage(message) {
  if (message.isUnread()) {
    var handled = handleAttachments(message);
    if (handled) {
      markMessageAsRead(message);
    }
  }
}

function handleAttachments(message) {
  var attachments = message.getAttachments();
  Logger.log(
    `Found ${
      attachments.length
    } attachments in message: ${message.getSubject()}`
  );
  var handled = false;

  attachments.forEach(function (attachment) {
    try {
      var attachmentType = getAttachementType(attachment);
      var filename = generateFilename(
        attachmentType,
        message.getDate().getTime(),
        attachment
      );
      var contentType = attachment.getContentType();
      var presignedUrl = getPresignedUrl(filename, contentType);
      if (presignedUrl) {
        uploadAttachmentToS3(presignedUrl, attachment, filename);
        Logger.log("Uploaded attachment successfully.");
        handled = true;
      }
    } catch (error) {
      Logger.log("Error handling attachment: " + error.toString());
    }
  });

  return handled;
}

function getAttachementType(attachment) {
  var attachmentName = attachment.getName();
  if (attachmentName.includes("Planner")) {
    return "planner";
  } else {
    throw new Error(
      "Unable to handle this document type. Only planner is accepted for now."
    );
  }
}

function generateFilename(type, emailTimestamp, attachment) {
  var attachmentName = attachment.getName();
  var filename = `emails/${type}/${emailTimestamp}_${attachmentName}`;
  Logger.log(`Generated filename for attachment: ${filename}`);
  return filename;
}

function getPresignedUrl(filename, contentType) {
  var payload = JSON.stringify({
    filename: filename,
    contentType: contentType,
  });
  var options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(PRESIGNER_URL, options);
  if (response.getResponseCode() == 200) {
    var jsonResponse = JSON.parse(response.getContentText());
    Logger.log("Successfully obtained presigned URL.");
    return jsonResponse.url;
  } else {
    throw new Error(
      `Failed to obtain presigned URL: ${response.getContentText()}`
    );
  }
}

function uploadAttachmentToS3(url, attachment, filename) {
  var options = {
    method: "put",
    contentType: attachment.getContentType(),
    payload: attachment.getBytes(),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() == 200) {
    Logger.log(`Successfully uploaded ${filename} to S3.`);
  } else {
    throw new Error(
      `Failed to upload ${filename} to S3: ${response.getContentText()}`
    );
  }
}

function markMessageAsRead(message) {
  message.markRead();
  Logger.log(`Marked message as read: ${message.getSubject()}.`);
}
