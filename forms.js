/**
 * Populate a <select> element with either numbers or text values
 * @param {string} selectId - id of the <select>
 * @param {Array|Object} options - either [array of strings] or {start, end} for numbers
 */
function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // For numeric ranges (e.g., {start: 1, end: 6})
  if (typeof options === "object" && options.start !== undefined) {
    for (let i = options.start; i <= options.end; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.text = i;
      select.appendChild(option);
    }
  }

  // For text arrays (e.g., ["Nursery", "Kinder 1", "Kinder 2"])
  if (Array.isArray(options)) {
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.text = opt;
      select.appendChild(option);
    });
  }
}

/**
 * Reusable form setup with API submission + success dialog
 * @param {string} formId - ID of the form
 * @param {string} dialogId - ID of the dialog element
 * @param {string} closeBtnId - ID of the close button inside the dialog
 */
function setupForm(formId, dialogId, closeBtnId) {
  const form = document.getElementById(formId);
  const dialog = document.getElementById(dialogId);
  const closeBtn = document.getElementById(closeBtnId);

  if (!form || !dialog || !closeBtn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    // Collect all form fields
    const formData = Object.fromEntries(new FormData(form).entries());

    // Build guardians array (filter out empty ones)
    const guardianNames = Array.from(
      form.querySelectorAll('input[name="guardian_name[]"]')
    ).map((el) => el.value.trim());

    const guardianRelations = Array.from(
      form.querySelectorAll('input[name="guardian_relation[]"]')
    ).map((el) => el.value.trim());

    const guardianPhones = Array.from(
      form.querySelectorAll('input[name="guardian_phone[]"]')
    ).map((el) => el.value.trim());

    const guardians = guardianNames
      .map((name, i) => ({
        name,
        relation: guardianRelations[i] || "",
        phone: guardianPhones[i] || "",
      }))
      .filter((g) => g.name || g.phone || g.relation); // keep filled ones

    formData.guardians = guardians;

    try {
      const res = await fetch("http://localhost:3000/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("✅ Submitted:", data);
        dialog.showModal();
        form.reset();
      } else {
        alert("❌ " + (data.message || "Failed to submit form."));
      }
    } catch (err) {
      console.error("⚠️ Submission Error:", err);
      alert("⚠️ Cannot connect to the server. Please check if backend is running.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  closeBtn.addEventListener("click", () => dialog.close());
}

/**
 * ➕ Dynamic Guardian Adder
 * Allows adding/removing guardian fields dynamically
 */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("guardians-container");
  const addBtn = document.getElementById("addGuardianBtn");

  if (!container || !addBtn) return;

  addBtn.addEventListener("click", () => {
    const guardianCount = container.querySelectorAll(".guardian-group").length + 1;

    const newGuardian = document.createElement("div");
    newGuardian.classList.add("guardian-group");
    newGuardian.innerHTML = `
      <label class="optional">Guardian ${guardianCount} Name (Optional)</label>
      <input type="text" name="guardian_name[]" placeholder="Enter guardian name">

      <label class="optional">Relationship to Child (Optional)</label>
      <input type="text" name="guardian_relation[]" placeholder="e.g. Mother, Father, Aunt">

      <label class="optional">Guardian ${guardianCount} Phone (Optional)</label>
      <input type="text" name="guardian_phone[]" pattern="[0-9]{11}" placeholder="e.g. 09123456789">

      <button type="button" class="removeGuardianBtn" style="margin-top:5px; background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px;">🗑 Remove</button>
    `;

    container.appendChild(newGuardian);

    // Allow removing guardian entry
    newGuardian.querySelector(".removeGuardianBtn").addEventListener("click", () => {
      container.removeChild(newGuardian);
    });
  });
});
