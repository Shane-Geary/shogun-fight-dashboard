/* =========================================
   T-03: Martialytics CSV Upload
   ========================================= */

// Get HTML elements
const csvFile = document.getElementById("csvFile");
const validateButton = document.getElementById("validateButton");
const startAuditButton = document.getElementById("startAuditButton");
const uploadStatus = document.getElementById("uploadStatus");
const fileStatus = document.getElementById("fileStatus");

const dropZone = document.getElementById("dropZone");
const selectedFile = document.getElementById("selectedFile");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

let currentFile = null;
let fileSelectionNumber = 0;

// Format file size in KB
function formatFileSize(bytes) {
    return (bytes / 1024).toFixed(1) + " KB";
}

// Remove previous validation results
function clearResults() {
    const previousResults = document.getElementById("validationResults");

    if (previousResults) {
        previousResults.remove();
    }
}

// Check the selected CSV file
async function validateFile(file) {
    fileSelectionNumber++;
    const selectionNumber = fileSelectionNumber;

    currentFile = null;

    validateButton.disabled = true;
    startAuditButton.disabled = true;
    selectedFile.hidden = true;

    fileStatus.textContent = "Validation Pending";
    fileStatus.style.color = "#3498eb";

    clearResults();

    if (!file) {
        uploadStatus.textContent = "Choose a report to begin your audit.";
        return;
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
        uploadStatus.textContent =
            "Invalid file type. Please select a CSV file.";
        return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        uploadStatus.textContent =
            "File is too large. Maximum size is 10 MB.";
        return;
    }

    try {
        const content = await file.text();

        // Ignore results if another file was selected
        if (selectionNumber !== fileSelectionNumber) {
            return;
        }

        // Check for an empty file
        if (!content.trim()) {
            uploadStatus.textContent =
                "The selected CSV file is empty.";
            return;
        }

        currentFile = file;

        fileName.textContent = file.name;
        fileSize.textContent =
            "CSV report · " + formatFileSize(file.size);

        selectedFile.hidden = false;

        uploadStatus.textContent =
            "Your report is selected. Validate your CSV to continue.";

        validateButton.disabled = false;

    } catch (error) {
        if (selectionNumber !== fileSelectionNumber) {
            return;
        }

        uploadStatus.textContent = "Error reading the CSV file.";
        console.error(error);
    }
}

// Choose Files button
csvFile.addEventListener("change", () => {
    validateFile(csvFile.files[0]);
});

// Prevent the browser from opening dropped files
window.addEventListener("dragover", (event) => {
    event.preventDefault();
});

window.addEventListener("drop", (event) => {
    event.preventDefault();
});

// Highlight the drop area
dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
});

// Remove the highlight
dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

// Handle dropped CSV files
dropZone.addEventListener("drop", (event) => {
    event.preventDefault();

    dropZone.classList.remove("dragover");

    const file = event.dataTransfer.files[0];

    validateFile(file);
});

// Validate CSV button
validateButton.addEventListener("click", async () => {
    if (!currentFile) {
        uploadStatus.textContent =
            "Please select a CSV file first.";
        return;
    }

    const fileBeingValidated = currentFile;
    const selectionNumber = fileSelectionNumber;

    validateButton.disabled = true;
    startAuditButton.disabled = true;

    uploadStatus.textContent =
        "Reading and validating your CSV report...";

    clearResults();

    try {
        const result = await parseMartialyticsCsv(fileBeingValidated);

        // Ignore results if another file was selected
        if (selectionNumber !== fileSelectionNumber) {
            return;
        }

        // Check for blocking errors
        const hasBlockingIssues = result.blockingErrors.length > 0;

        if (hasBlockingIssues) {
            fileStatus.textContent = "Audit Blocked";
            fileStatus.style.color = "#dc3545";
            startAuditButton.disabled = true;

        } else if (result.errors.length > 0) {
            fileStatus.textContent = "Ready with Warnings";
            fileStatus.style.color = "#d97706";
            startAuditButton.disabled = false;

        } else {
            fileStatus.textContent = "Ready for Audit";
            fileStatus.style.color = "#16a34a";
            startAuditButton.disabled = false;
        }

        // Display the number of student records
        uploadStatus.textContent =
            `CSV processed! Found ${result.totalRecords} student records.`;

        // Create validation results section
        const validationResults = document.createElement("div");
        validationResults.id = "validationResults";
        validationResults.className = "validation-results";

        if (result.errors.length === 0 && result.blockingErrors.length === 0) {
            const successMessage = document.createElement("p");
            successMessage.textContent =
                "All records passed the current validation checks.";

            validationResults.appendChild(successMessage);

        } else {
            const errorHeading = document.createElement("h3");

            const totalIssues =
                result.errors.length + result.blockingErrors.length;

            errorHeading.textContent =
                `Validation issues found: ${totalIssues}`;

            validationResults.appendChild(errorHeading);

            const errorList = document.createElement("ul");

            // Display blocking errors
            result.blockingErrors.forEach(error => {
                const listItem = document.createElement("li");

                listItem.textContent = `BLOCKING: ${error}`;
                listItem.style.color = "#dc3545";

                errorList.appendChild(listItem);
            });

            // Display warnings
            result.errors.forEach(error => {
                const listItem = document.createElement("li");

                listItem.textContent = `WARNING: ${error}`;
                listItem.style.color = "#d97706";

                errorList.appendChild(listItem);
            });

            validationResults.appendChild(errorList);
        }

        // Show validation results below the upload section
        document.querySelector(".upload-section")
            .appendChild(validationResults);

        // Automatically scroll to the validation results
        validationResults.scrollIntoView({
            behavior: "smooth",
            block: "end"
        });

    } catch (error) {
        if (selectionNumber !== fileSelectionNumber) {
            return;
        }

        uploadStatus.textContent =
            `Unable to process CSV: ${error.message}`;

        console.error("CSV validation error:", error);

        fileStatus.textContent = "Audit Blocked";
        fileStatus.style.color = "#dc3545";

        startAuditButton.disabled = true;

    } finally {
        if (selectionNumber === fileSelectionNumber) {
            validateButton.disabled = false;
        }
    }
});