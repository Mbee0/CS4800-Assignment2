let recipes = [];
let editingId = null;

let ingredients = [];
// steps are stored from the step textareas
function getStepsFromUI() {
    const textareas = [...document.querySelectorAll(".stepInput")];
    return textareas.map(t => t.value.trim()).filter(Boolean);
}

function minutesToLabel(total) {
    total = Number(total || 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

async function apiGetRecipes() {
    const res = await fetch("/api/recipes");
    if (!res.ok) throw new Error("Failed to load recipes");
    return await res.json();
}

async function apiCreateRecipe(payload) {
    const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to create");
    return data;
}

async function apiUpdateRecipe(id, payload) {
    const res = await fetch(`/api/recipes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to update");
    return data;
}

function qs(id) { return document.getElementById(id); }

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function renderGrid() {
    const grid = qs("grid");
    const empty = qs("emptyState");
    grid.innerHTML = "";

    if (!recipes.length) {
        show(empty);
        return;
    }
    hide(empty);

    for (const r of recipes) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
        <div class="cardTop">
            <div class="cardTopLeft">
                <h3 class="cardTitle"></h3>
                <div class="cardTime"></div>
            </div>

            <button class="starBtn" aria-label="Star recipe" title="Star">
                <span class="starIcon"></span>
            </button>
        </div>
        <p class="cardDesc"></p>
    `;

        card.querySelector(".cardTitle").textContent = r.name || "(Untitled)";
        card.querySelector(".cardTime").textContent = minutesToLabel(r.durationMinutes);
        card.querySelector(".cardDesc").textContent = r.description || "";

        const starBtn = card.querySelector(".starBtn");
        const starIcon = card.querySelector(".starIcon");

        function renderStar() {
            starIcon.textContent = r.starred ? "★" : "☆";
            starBtn.classList.toggle("starred", !!r.starred);
        }
        renderStar();

        // Clicking the STAR should not open edit modal
        starBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const next = !r.starred;
            try {
                // Option 1: PATCH toggle endpoint (recommended)
                const res = await fetch(`/api/recipes/${r.id}/star`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ starred: next })
                });
                if (!res.ok) throw new Error("Failed to star");
                const updated = await res.json();

                // Update local list
                const idx = recipes.findIndex(x => x.id === r.id);
                if (idx !== -1) recipes[idx] = updated;

                recipes.sort((a, b) => (b.starred === true) - (a.starred === true));
                // Re-render (simple + reliable)
                renderGrid();
            } catch (err) {
                alert(err.message || "Could not update star");
            }
        });
        card.addEventListener("click", () => openEditModal(r));

        // Add card to grid
        grid.appendChild(card);
    }
}

function clearForm() {
    editingId = null;
    ingredients = [];
    qs("nameInput").value = "";
    qs("descInput").value = "";
    qs("hoursInput").value = "";
    qs("minsInput").value = "";
    qs("ingredientEntry").value = "";
    qs("stepsList").innerHTML = "";
    hide(qs("formError"));

    // Start with one step input
    addStepRow("");
    renderIngredients();
}

function openModal(title) {
    qs("modalTitle").textContent = title;
    show(qs("modalBackdrop"));
}

function closeModal() {
    hide(qs("modalBackdrop"));
}

function renderIngredients() {
    const wrap = qs("ingredientsChips");
    wrap.innerHTML = "";
    for (let i = 0; i < ingredients.length; i++) {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = `<span></span><button title="Remove">✕</button>`;
        chip.querySelector("span").textContent = ingredients[i];
        chip.querySelector("button").addEventListener("click", () => {
            ingredients.splice(i, 1);
            renderIngredients();
        });
        wrap.appendChild(chip);
    }
}

function addIngredientFromEntry() {
    const entry = qs("ingredientEntry");
    const val = entry.value.trim();
    if (!val) return;
    ingredients.push(val);
    entry.value = "";
    renderIngredients();
}

function addStepRow(value = "") {
    const list = qs("stepsList");
    const idx = list.children.length + 1;

    const row = document.createElement("div");
    row.className = "stepRow";
    row.innerHTML = `
    <div class="stepNum">${idx}.</div>
    <textarea class="stepInput" placeholder="Describe step ${idx}..."></textarea>
    <button class="stepRemove" title="Remove step">✕</button>
  `;

    const textarea = row.querySelector(".stepInput");
    textarea.value = value;

    // Press Enter to create next step (Shift+Enter for newline)
    textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // Only add next if current has text
            if (textarea.value.trim()) {
                addStepRow("");
                // focus newly created textarea
                const all = [...document.querySelectorAll(".stepInput")];
                all[all.length - 1].focus();
            }
        }
    });

    row.querySelector(".stepRemove").addEventListener("click", () => {
        row.remove();
        renumberSteps();
    });

    list.appendChild(row);
}

function renumberSteps() {
    const list = qs("stepsList");
    [...list.children].forEach((row, i) => {
        const num = row.querySelector(".stepNum");
        num.textContent = `${i + 1}.`;
        const ta = row.querySelector(".stepInput");
        ta.placeholder = `Describe step ${i + 1}...`;
    });
}

function openNewModal() {
    clearForm();
    openModal("New Recipe");
}

function openEditModal(recipe) {
    clearForm();
    editingId = recipe.id;

    qs("nameInput").value = recipe.name || "";
    qs("descInput").value = recipe.description || "";

    const total = Number(recipe.durationMinutes || 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    qs("hoursInput").value = h ? String(h) : "";
    qs("minsInput").value = m ? String(m) : "";

    ingredients = (recipe.ingredients || []).slice();
    renderIngredients();

    // steps
    qs("stepsList").innerHTML = "";
    const steps = recipe.steps || [];
    if (steps.length) steps.forEach(s => addStepRow(s));
    else addStepRow("");

    openModal("Edit Recipe");
}

function readDurationMinutes() {
    const h = parseInt(qs("hoursInput").value || "0", 10);
    const m = parseInt(qs("minsInput").value || "0", 10);
    const total = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    return Math.max(0, total);
}

function showError(msg) {
    const p = qs("formError");
    p.textContent = msg;
    show(p);
}

async function saveRecipe() {
    hide(qs("formError"));

    const name = qs("nameInput").value.trim();
    const description = qs("descInput").value.trim();
    const durationMinutes = readDurationMinutes();
    const steps = getStepsFromUI();

    if (!name) return showError("Dish name is required.");
    if (!ingredients.length) return showError("Add at least one ingredient.");
    if (!steps.length) return showError("Add at least one step.");

    const payload = {
        name,
        description,
        durationMinutes,
        ingredients,
        steps,
    };

    try {
        if (editingId) {
            await apiUpdateRecipe(editingId, payload);
        } else {
            await apiCreateRecipe(payload);
        }
        recipes = await apiGetRecipes();
        renderGrid();
        closeModal();
    } catch (err) {
        showError(err.message || "Something went wrong.");
    }
}

async function init() {
    // Buttons
    qs("newRecipeBtn").addEventListener("click", openNewModal);
    qs("closeModalBtn").addEventListener("click", closeModal);
    qs("cancelBtn").addEventListener("click", closeModal);
    qs("saveBtn").addEventListener("click", saveRecipe);

    // Close modal on backdrop click
    qs("modalBackdrop").addEventListener("click", (e) => {
        if (e.target === qs("modalBackdrop")) closeModal();
    });

    // Ingredient entry press Enter => add chip
    qs("ingredientEntry").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addIngredientFromEntry();
        }
    });

    qs("addStepBtn").addEventListener("click", () => {
        addStepRow("");
        const all = [...document.querySelectorAll(".stepInput")];
        all[all.length - 1].focus();
    });

    // Load recipes
    recipes = await apiGetRecipes();
    recipes.sort((a, b) => (b.starred === true) - (a.starred === true));
    renderGrid();
}

init();