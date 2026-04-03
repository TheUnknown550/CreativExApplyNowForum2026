(function attachCreativExApplyForm(window, document) {
  "use strict";

  var DEFAULT_CONFIG = {
    apiBaseUrl: "",
    submitPath: "/applications",
    mockMode: true,
    timeoutMs: 15000,
    extraHeaders: {},
    onSuccess: null,
    onError: null
  };

  var FIELD_LABELS = {
    firstNameTh: "ชื่อผู้เรียน (ภาษาไทย)",
    lastNameTh: "นามสกุลผู้เรียน (ภาษาไทย)",
    firstNameEn: "ชื่อผู้เรียน (English)",
    lastNameEn: "นามสกุลผู้เรียน (English)",
    nicknameTh: "ชื่อเล่นผู้เรียน (ภาษาไทย)",
    nicknameEn: "ชื่อเล่นผู้เรียน (ภาษาอังกฤษ)",
    email: "อีเมล",
    phone: "เบอร์โทรติดต่อ",
    lineId: "Line ID",
    jobTitle: "ตำแหน่งงาน",
    organization: "องค์กร",
    educationHistory: "ประวัติการศึกษา",
    executivePrograms: "หลักสูตรผู้บริหารที่เคยอบรม",
    coordinatorInfo: "ผู้ประสานงาน",
    birthDate: "วัน/เดือน/ปีเกิดผู้เรียน (ค.ศ.)",
    additionalInfo: "ข้อมูลเพิ่มเติม",
    photoFile: "รูปถ่าย",
    resumeFile: "CV / Resume"
  };

  var FILE_RULES = {
    photoFile: {
      maxSize: 5 * 1024 * 1024,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      requiredMessage: "กรุณาแนบรูปถ่าย",
      typeMessage: "รูปถ่ายต้องเป็นไฟล์ JPG, PNG หรือ WEBP เท่านั้น",
      sizeMessage: "รูปถ่ายต้องมีขนาดไม่เกิน 5 MB"
    },
    resumeFile: {
      maxSize: 10 * 1024 * 1024,
      allowedTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      allowedExtensions: [".pdf", ".doc", ".docx"],
      requiredMessage: "กรุณาแนบ CV / Resume",
      typeMessage: "CV / Resume ต้องเป็นไฟล์ PDF, DOC หรือ DOCX เท่านั้น",
      sizeMessage: "CV / Resume ต้องมีขนาดไม่เกิน 10 MB"
    }
  };

  var state = {
    config: copyConfig(DEFAULT_CONFIG),
    initialized: false
  };

  function copyConfig(source) {
    return {
      apiBaseUrl: source.apiBaseUrl || "",
      submitPath: source.submitPath || "/applications",
      mockMode: source.mockMode !== false,
      timeoutMs: Number(source.timeoutMs) > 0 ? Number(source.timeoutMs) : 15000,
      extraHeaders: source.extraHeaders ? Object.assign({}, source.extraHeaders) : {},
      onSuccess: typeof source.onSuccess === "function" ? source.onSuccess : null,
      onError: typeof source.onError === "function" ? source.onError : null
    };
  }

  function mergeConfig(base, patch) {
    var next = copyConfig(base);
    if (!patch || typeof patch !== "object") {
      return next;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "apiBaseUrl")) {
      next.apiBaseUrl = String(patch.apiBaseUrl || "");
    }

    if (Object.prototype.hasOwnProperty.call(patch, "submitPath")) {
      next.submitPath = String(patch.submitPath || "/applications");
    }

    if (Object.prototype.hasOwnProperty.call(patch, "mockMode")) {
      next.mockMode = Boolean(patch.mockMode);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "timeoutMs")) {
      next.timeoutMs = Number(patch.timeoutMs) > 0 ? Number(patch.timeoutMs) : next.timeoutMs;
    }

    if (patch.extraHeaders && typeof patch.extraHeaders === "object") {
      next.extraHeaders = Object.assign({}, next.extraHeaders, patch.extraHeaders);
    }

    if (typeof patch.onSuccess === "function") {
      next.onSuccess = patch.onSuccess;
    } else if (patch.onSuccess === null) {
      next.onSuccess = null;
    }

    if (typeof patch.onError === "function") {
      next.onError = patch.onError;
    } else if (patch.onError === null) {
      next.onError = null;
    }

    return next;
  }

  function init(options) {
    state.config = mergeConfig(DEFAULT_CONFIG, options || {});

    var form = document.getElementById("application-form");
    if (!form) {
      return;
    }

    updateAllFileLabels(form);

    if (state.initialized) {
      return;
    }

    form.addEventListener("submit", handleSubmit);
    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleChange);
    state.initialized = true;
  }

  function handleInput(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.id === "phone") {
      target.value = sanitizePhone(target.value);
    }

    if (target.id === "birthDay" || target.id === "birthMonth" || target.id === "birthYear") {
      target.value = digitsOnly(target.value, target.maxLength || 4);
      clearFieldError("birthDate");
      return;
    }

    if (target.id && FIELD_LABELS[target.id]) {
      clearFieldError(target.id);
    }
  }

  function handleChange(event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.type === "file") {
      updateFileLabel(target);
      validateFileField(target.id, target.files && target.files[0] ? target.files[0] : null);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    var form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    clearStatusMessage();
    var validation = validateForm(form);

    if (!validation.valid) {
      renderErrorSummary(validation.errors);
      if (validation.firstInvalid) {
        validation.firstInvalid.focus();
        validation.firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    hideErrorSummary();

    var values = readFormValues(form);
    var payload = normalizePayload(values);
    var formData = buildFormData(payload);
    var submitButton = document.getElementById("submit-button");
    var originalLabel = submitButton ? submitButton.textContent : "";

    setLoadingState(true, submitButton);
    setStatusMessage("is-loading", "กำลังส่งข้อมูลใบสมัคร กรุณารอสักครู่...");

    submitApplication(formData, payload)
      .then(function handleSuccess(response) {
        setLoadingState(false, submitButton, originalLabel);
        setStatusMessage(
          "is-success",
          state.config.mockMode
            ? "ส่งข้อมูลในโหมดจำลองเรียบร้อยแล้ว สามารถเชื่อมต่อ API จริงได้ทันทีเมื่อพร้อม"
            : "ส่งใบสมัครเรียบร้อยแล้ว ทีมงานจะติดต่อกลับตามข้อมูลที่ท่านระบุไว้"
        );
        form.reset();
        updateAllFileLabels(form);
        clearAllErrors();

        if (state.config.onSuccess) {
          state.config.onSuccess({
            response: response,
            payload: payload
          });
        }
      })
      .catch(function handleFailure(error) {
        setLoadingState(false, submitButton, originalLabel);
        setStatusMessage(
          "is-error",
          error && error.message ? error.message : "ไม่สามารถส่งใบสมัครได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"
        );

        if (state.config.onError) {
          state.config.onError(error);
        }
      });
  }

  function validateForm(form) {
    clearAllErrors();

    var errors = [];
    var firstInvalid = null;
    var values = readFormValues(form);
    var requiredTextFields = [
      "firstNameTh",
      "lastNameTh",
      "firstNameEn",
      "lastNameEn",
      "nicknameTh",
      "nicknameEn",
      "email",
      "phone",
      "jobTitle",
      "organization",
      "educationHistory"
    ];

    requiredTextFields.forEach(function validateRequired(fieldName) {
      if (!values[fieldName]) {
        registerError(fieldName, "กรุณากรอก" + FIELD_LABELS[fieldName], getInput(fieldName));
      }
    });

    if (values.email && !isValidEmail(values.email)) {
      registerError("email", "กรุณากรอกอีเมลให้ถูกต้อง", getInput("email"));
    }

    if (values.phone && !isValidThaiPhone(values.phone)) {
      registerError("phone", "กรุณากรอกเบอร์โทรติดต่อเป็นตัวเลข 9 ถึง 10 หลัก", getInput("phone"));
    }

    var birthValidation = validateBirthDate(values.birthDay, values.birthMonth, values.birthYear);
    if (!birthValidation.valid) {
      registerError("birthDate", birthValidation.message, getInput("birthDay"));
    }

    var photoFile = values.photoFile;
    var resumeFile = values.resumeFile;

    if (!validateFileField("photoFile", photoFile)) {
      registerError("photoFile", getFieldErrorText("photoFile"), getInput("photoFile"));
    }

    if (!validateFileField("resumeFile", resumeFile)) {
      registerError("resumeFile", getFieldErrorText("resumeFile"), getInput("resumeFile"));
    }

    function registerError(fieldName, message, element) {
      errors.push({
        fieldName: fieldName,
        label: FIELD_LABELS[fieldName],
        message: message
      });
      setFieldError(fieldName, message);
      if (!firstInvalid && element) {
        firstInvalid = element;
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      firstInvalid: firstInvalid
    };
  }

  function validateBirthDate(dayValue, monthValue, yearValue) {
    var day = Number(dayValue);
    var month = Number(monthValue);
    var year = Number(yearValue);
    var currentYear = new Date().getFullYear();

    if (!dayValue || !monthValue || !yearValue) {
      return {
        valid: false,
        message: "กรุณากรอกวัน เดือน และปีเกิดให้ครบถ้วน"
      };
    }

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return {
        valid: false,
        message: "กรุณากรอกวันเกิดเป็นตัวเลขเท่านั้น"
      };
    }

    if (year < 1900 || year > currentYear) {
      return {
        valid: false,
        message: "กรุณากรอกปีเกิดเป็นค.ศ. ระหว่าง 1900 ถึง " + currentYear
      };
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return {
        valid: false,
        message: "กรุณากรอกวันและเดือนเกิดให้ถูกต้อง"
      };
    }

    var candidate = new Date(year, month - 1, day);
    var isExactDate =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;

    if (!isExactDate) {
      return {
        valid: false,
        message: "วันเดือนปีเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"
      };
    }

    return {
      valid: true,
      normalized: [year, padNumber(month), padNumber(day)].join("-")
    };
  }

  function validateFileField(fieldName, file) {
    var rules = FILE_RULES[fieldName];
    var input = getInput(fieldName);
    var wrapper = document.querySelector('[data-file-wrapper="' + fieldName + '"]');

    clearFieldError(fieldName);

    if (wrapper) {
      wrapper.classList.remove("is-invalid");
    }

    if (!rules) {
      return true;
    }

    if (!file) {
      setFieldError(fieldName, rules.requiredMessage);
      if (wrapper) {
        wrapper.classList.add("is-invalid");
      }
      if (input) {
        input.setAttribute("aria-invalid", "true");
      }
      return false;
    }

    var lowerName = file.name.toLowerCase();
    var hasAllowedType = rules.allowedTypes.indexOf(file.type) !== -1;
    var hasAllowedExtension = rules.allowedExtensions.some(function checkExtension(extension) {
      return lowerName.endsWith(extension);
    });

    if (!(hasAllowedType || hasAllowedExtension)) {
      setFieldError(fieldName, rules.typeMessage);
      if (wrapper) {
        wrapper.classList.add("is-invalid");
      }
      if (input) {
        input.setAttribute("aria-invalid", "true");
      }
      return false;
    }

    if (file.size > rules.maxSize) {
      setFieldError(fieldName, rules.sizeMessage);
      if (wrapper) {
        wrapper.classList.add("is-invalid");
      }
      if (input) {
        input.setAttribute("aria-invalid", "true");
      }
      return false;
    }

    return true;
  }

  function readFormValues(form) {
    return {
      firstNameTh: getTrimmedValue(form, "firstNameTh"),
      lastNameTh: getTrimmedValue(form, "lastNameTh"),
      firstNameEn: getTrimmedValue(form, "firstNameEn"),
      lastNameEn: getTrimmedValue(form, "lastNameEn"),
      nicknameTh: getTrimmedValue(form, "nicknameTh"),
      nicknameEn: getTrimmedValue(form, "nicknameEn"),
      email: getTrimmedValue(form, "email"),
      phone: sanitizePhone(getTrimmedValue(form, "phone")),
      lineId: getTrimmedValue(form, "lineId"),
      jobTitle: getTrimmedValue(form, "jobTitle"),
      organization: getTrimmedValue(form, "organization"),
      educationHistory: getTrimmedValue(form, "educationHistory"),
      executivePrograms: getTrimmedValue(form, "executivePrograms"),
      coordinatorInfo: getTrimmedValue(form, "coordinatorInfo"),
      birthDay: digitsOnly(getTrimmedValue(form, "birthDay"), 2),
      birthMonth: digitsOnly(getTrimmedValue(form, "birthMonth"), 2),
      birthYear: digitsOnly(getTrimmedValue(form, "birthYear"), 4),
      additionalInfo: getTrimmedValue(form, "additionalInfo"),
      marketingConsent: Boolean(form.elements.marketingConsent && form.elements.marketingConsent.checked),
      photoFile: form.elements.photoFile && form.elements.photoFile.files ? form.elements.photoFile.files[0] || null : null,
      resumeFile: form.elements.resumeFile && form.elements.resumeFile.files ? form.elements.resumeFile.files[0] || null : null
    };
  }

  function normalizePayload(values) {
    var birthValidation = validateBirthDate(values.birthDay, values.birthMonth, values.birthYear);

    return {
      firstNameTh: values.firstNameTh,
      lastNameTh: values.lastNameTh,
      firstNameEn: values.firstNameEn,
      lastNameEn: values.lastNameEn,
      nicknameTh: values.nicknameTh,
      nicknameEn: values.nicknameEn,
      email: values.email,
      phone: values.phone,
      lineId: values.lineId,
      jobTitle: values.jobTitle,
      organization: values.organization,
      educationHistory: values.educationHistory,
      executivePrograms: values.executivePrograms,
      coordinatorInfo: values.coordinatorInfo,
      birthDate: birthValidation.valid ? birthValidation.normalized : "",
      additionalInfo: values.additionalInfo,
      marketingConsent: values.marketingConsent,
      photoFile: values.photoFile,
      resumeFile: values.resumeFile
    };
  }

  function buildFormData(payload) {
    var formData = new FormData();

    Object.keys(payload).forEach(function appendValue(key) {
      var value = payload[key];
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (typeof value === "boolean") {
        formData.append(key, value ? "true" : "false");
        return;
      }

      formData.append(key, value == null ? "" : String(value));
    });

    return formData;
  }

  function submitApplication(formData, payload) {
    if (state.config.mockMode) {
      console.info("[CreativExApplyForm] Mock payload preview", createSafePayloadPreview(payload));

      return new Promise(function mockSubmission(resolve) {
        window.setTimeout(function finishMock() {
          resolve({
            ok: true,
            mode: "mock",
            endpoint: resolveEndpoint()
          });
        }, 1200);
      });
    }

    return fetchWithTimeout(
      resolveEndpoint(),
      {
        method: "POST",
        headers: state.config.extraHeaders,
        body: formData
      },
      state.config.timeoutMs
    ).then(function parseResponse(response) {
      if (!response.ok) {
        throw new Error("ส่งใบสมัครไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ API และลองใหม่อีกครั้ง");
      }

      var responseType = response.headers.get("content-type") || "";
      if (responseType.indexOf("application/json") !== -1) {
        return response.json();
      }
      return response.text();
    });
  }

  function createSafePayloadPreview(payload) {
    return {
      firstNameTh: payload.firstNameTh,
      lastNameTh: payload.lastNameTh,
      firstNameEn: payload.firstNameEn,
      lastNameEn: payload.lastNameEn,
      nicknameTh: payload.nicknameTh,
      nicknameEn: payload.nicknameEn,
      email: payload.email,
      phone: payload.phone,
      lineId: payload.lineId,
      jobTitle: payload.jobTitle,
      organization: payload.organization,
      educationHistory: payload.educationHistory,
      executivePrograms: payload.executivePrograms,
      coordinatorInfo: payload.coordinatorInfo,
      birthDate: payload.birthDate,
      additionalInfo: payload.additionalInfo,
      marketingConsent: payload.marketingConsent,
      photoFile: createFilePreview(payload.photoFile),
      resumeFile: createFilePreview(payload.resumeFile)
    };
  }

  function createFilePreview(file) {
    if (!(file instanceof File)) {
      return null;
    }

    return {
      name: file.name,
      type: file.type || "unknown",
      size: file.size
    };
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = window.setTimeout(function abortRequest() {
      controller.abort();
    }, timeoutMs);

    var nextOptions = Object.assign({}, options, {
      signal: controller.signal
    });

    return fetch(url, nextOptions)
      .catch(function handleAbort(error) {
        if (error && error.name === "AbortError") {
          throw new Error("การเชื่อมต่อ API ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
        }
        throw error;
      })
      .finally(function clearRequestTimeout() {
        window.clearTimeout(timeoutId);
      });
  }

  function resolveEndpoint() {
    var base = String(state.config.apiBaseUrl || "").trim();
    var path = String(state.config.submitPath || "/applications").trim();

    if (!base) {
      return path || "/applications";
    }

    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }

  function updateAllFileLabels(form) {
    ["photoFile", "resumeFile"].forEach(function updateLabel(fieldName) {
      var input = form.elements[fieldName];
      if (input) {
        updateFileLabel(input);
      }
    });
  }

  function updateFileLabel(input) {
    var label = document.querySelector('[data-file-label="' + input.id + '"]');
    if (!label) {
      return;
    }

    var file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) {
      label.textContent = "ยังไม่ได้เลือกไฟล์";
      return;
    }

    label.textContent = file.name + " (" + formatFileSize(file.size) + ")";
  }

  function renderErrorSummary(errors) {
    var summary = document.getElementById("error-summary");
    var list = document.getElementById("error-summary-list");

    if (!summary || !list) {
      return;
    }

    list.innerHTML = errors
      .map(function mapError(error) {
        var targetId = error.fieldName === "birthDate" ? "birthDay" : error.fieldName;
        return (
          '<li><a href="#' +
          targetId +
          '" data-focus-target="' +
          targetId +
          '">' +
          escapeHtml(error.message) +
          "</a></li>"
        );
      })
      .join("");

    summary.hidden = false;
    summary.focus();

    list.querySelectorAll("[data-focus-target]").forEach(function bindErrorLink(link) {
      link.addEventListener("click", function handleLinkClick(clickEvent) {
        clickEvent.preventDefault();
        var target = document.getElementById(link.getAttribute("data-focus-target"));
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  function hideErrorSummary() {
    var summary = document.getElementById("error-summary");
    var list = document.getElementById("error-summary-list");

    if (summary) {
      summary.hidden = true;
    }

    if (list) {
      list.innerHTML = "";
    }
  }

  function setStatusMessage(stateClass, message) {
    var status = document.getElementById("submit-status");
    if (!status) {
      return;
    }

    status.className = "submit-status " + stateClass;
    status.textContent = message;
  }

  function clearStatusMessage() {
    var status = document.getElementById("submit-status");
    if (!status) {
      return;
    }

    status.className = "submit-status";
    status.textContent = "";
  }

  function setLoadingState(isLoading, submitButton, originalLabel) {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "Submitting..." : originalLabel || "Submit Application";
  }

  function setFieldError(fieldName, message) {
    var errorElement = document.getElementById(fieldName + "-error");
    var input = getInput(fieldName);
    var wrapper =
      fieldName === "photoFile" || fieldName === "resumeFile"
        ? document.querySelector('[data-file-wrapper="' + fieldName + '"]')
        : null;

    if (errorElement) {
      errorElement.textContent = message || "";
    }

    if (fieldName === "birthDate") {
      ["birthDay", "birthMonth", "birthYear"].forEach(function updatePart(partId) {
        var part = document.getElementById(partId);
        if (part) {
          part.classList.toggle("is-invalid", Boolean(message));
          part.setAttribute("aria-invalid", message ? "true" : "false");
        }
      });
      return;
    }

    if (wrapper) {
      wrapper.classList.toggle("is-invalid", Boolean(message));
    }

    if (input) {
      input.classList.toggle("is-invalid", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function clearFieldError(fieldName) {
    setFieldError(fieldName, "");
  }

  function clearAllErrors() {
    Object.keys(FIELD_LABELS).forEach(function clearField(fieldName) {
      clearFieldError(fieldName);
    });
    hideErrorSummary();
  }

  function getFieldErrorText(fieldName) {
    var errorElement = document.getElementById(fieldName + "-error");
    return errorElement ? errorElement.textContent : "";
  }

  function getInput(fieldName) {
    if (fieldName === "birthDate") {
      return document.getElementById("birthDay");
    }
    return document.getElementById(fieldName);
  }

  function getTrimmedValue(form, name) {
    var field = form.elements[name];
    if (!field || typeof field.value !== "string") {
      return "";
    }
    return field.value.trim();
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/[^\d]/g, "").slice(0, 10);
  }

  function digitsOnly(value, maxLength) {
    return String(value || "")
      .replace(/[^\d]/g, "")
      .slice(0, maxLength);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidThaiPhone(value) {
    return /^\d{9,10}$/.test(value);
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function formatFileSize(size) {
    var megabytes = size / (1024 * 1024);
    if (megabytes >= 1) {
      return megabytes.toFixed(megabytes >= 10 ? 0 : 1) + " MB";
    }
    return Math.max(1, Math.round(size / 1024)) + " KB";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.CreativExApplyForm = {
    init: init
  };
})(window, document);
