async function fetchItems() {
    const res = await fetch("/api/items");
    const items = await res.json();
    renderItems(items);
}

function renderItems(items) {
    const ul = document.getElementById("itemsList");
    ul.innerHTML = "";
    for (const item of items) {
        const li = document.createElement("li");
        li.textContent = item.text;
        ul.appendChild(li);
    }
}

async function addItem(text) {
    const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to add item");
        return;
    }

    await fetchItems();
}

document.getElementById("itemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("textInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await addItem(text);
});

fetchItems();