
let salesData = [];

let monthlyChart = null;
let productChart = null;


// READ CSV FILE

function loadCSV() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a CSV file.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        processCSV(event.target.result);
    };

    reader.readAsText(file);
}


// PARSE CSV

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        let char = text[i];

        if (char === '"') {
            if (insideQuotes && text[i + 1] === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        }
        else if (char === "," && !insideQuotes) {
            row.push(field.trim());
            field = "";
        }
        else if ((char === "\n" || char === "\r") && !insideQuotes) {
            row.push(field.trim());

            if (row.some(value => value !== "")) {
                rows.push(row);
            }

            row = [];
            field = "";

            if (char === "\r" && text[i + 1] === "\n") {
                i++;
            }
        }
        else {
            field += char;
        }
    }

    if (insideQuotes) {
        throw new Error("Unclosed quotation mark.");
    }

    if (field !== "" || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
    }

    return rows;
}


// PROCESS AND VALIDATE CSV

function processCSV(text) {
    try {
        const rows = parseCSV(text);

        if (rows.length < 2) {
            alert("CSV must contain headers and sales records.");
            return;
        }

        const headers = rows[0].map(h =>
            h.replace(/^\uFEFF/, "").trim().toLowerCase()
        );

        const required = [
            "product_name",
            "sale_date",
            "quantity",
            "unit_price",
            "region"
        ];

        const missing = required.filter(h => !headers.includes(h));

        if (missing.length > 0) {
            alert("Missing columns: " + missing.join(", "));
            return;
        }

        const index = {};

        headers.forEach((header, i) => {
            if (index[header] !== undefined) {
                throw new Error("Duplicate column: " + header);
            }

            index[header] = i;
        });

        let validRecords = [];
        let errors = [];
        let duplicateCount = 0;

        const seen = new Set();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const line = i + 1;

            if (row.length !== headers.length) {
                errors.push("Row " + line + ": Incorrect columns.");
                continue;
            }

            const product = row[index.product_name];
            const date = row[index.sale_date];
            const quantityText = row[index.quantity];
            const priceText = row[index.unit_price];
            const region = row[index.region];

            const category = index.category !== undefined
                ? row[index.category] || "Uncategorized"
                : "Uncategorized";

            if (!product || !date || !quantityText ||
                !priceText || !region) {

                errors.push("Row " + line + ": Missing values.");
                continue;
            }

            const quantity = Number(quantityText);
            const price = Number(priceText);

            const validDate =
                /^\d{4}-\d{2}-\d{2}$/.test(date) &&
                !Number.isNaN(Date.parse(date)) &&
                new Date(date + "T00:00:00Z")
                    .toISOString().slice(0, 10) === date;

            if (!validDate) {
                errors.push("Row " + line + ": Invalid date.");
                continue;
            }

            if (!Number.isInteger(quantity) || quantity <= 0) {
                errors.push("Row " + line + ": Invalid quantity.");
                continue;
            }

            if (!Number.isFinite(price) || price < 0) {
                errors.push("Row " + line + ": Invalid price.");
                continue;
            }

            const record = {
                product,
                date,
                quantity,
                price,
                region,
                category
            };

            const duplicateKey = JSON.stringify(record);

            if (seen.has(duplicateKey)) {
                duplicateCount++;
                continue;
            }

            seen.add(duplicateKey);
            validRecords.push(record);
        }

        salesData = validRecords;

        updateDashboard();

        showReport(errors, duplicateCount, validRecords.length);

        document.getElementById("status").textContent =
            "CSV uploaded successfully.";
    }
    catch (error) {
        alert("CSV Error: " + error.message);
    }
}


// CALCULATE REVENUE

function calculateRevenue() {
    let total = 0;

    for (let sale of salesData) {
        total += sale.quantity * sale.price;
    }

    return total;
}


// CALCULATE QUANTITY

function calculateQuantity() {
    let total = 0;

    for (let sale of salesData) {
        total += sale.quantity;
    }

    return total;
}


// FIND TOP PRODUCT

function findTopProduct() {
    let products = {};

    for (let sale of salesData) {
        products[sale.product] =
            (products[sale.product] || 0) + sale.quantity;
    }

    let top = "-";
    let max = 0;

    for (let product in products) {
        if (products[product] > max) {
            max = products[product];
            top = product;
        }
    }

    return top;
}


// UPDATE DASHBOARD

function updateDashboard() {
    document.getElementById("revenue").textContent =
        "₹" + calculateRevenue().toLocaleString("en-IN");

    document.getElementById("quantity").textContent =
        calculateQuantity();

    document.getElementById("records").textContent =
        salesData.length;

    document.getElementById("topProduct").textContent =
        findTopProduct();

    displayTable();
    displayCharts();
}


// DISPLAY TABLE

function displayTable() {
    const table = document.getElementById("salesTable");

    table.innerHTML = "";

    for (let sale of salesData) {
        let tr = document.createElement("tr");

        const values = [
            sale.product,
            sale.date,
            sale.quantity,
            "₹" + sale.price.toFixed(2),
            "₹" + (sale.quantity * sale.price).toFixed(2),
            sale.region
        ];

        values.forEach(value => {
            let td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
        });

        table.appendChild(tr);
    }
}


// DISPLAY CHARTS

function displayCharts() {
    let monthly = {};
    let products = {};

    for (let sale of salesData) {
        let month = sale.date.slice(0, 7);

        monthly[month] =
            (monthly[month] || 0) +
            sale.quantity * sale.price;

        products[sale.product] =
            (products[sale.product] || 0) +
            sale.quantity;
    }

    let months = Object.keys(monthly).sort();

    let productNames = Object.keys(products).sort(
        (a, b) => products[b] - products[a]
    );

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    if (productChart) {
        productChart.destroy();
    }

    monthlyChart = new Chart(
        document.getElementById("monthlyChart"),
        {
            type: "line",
            data: {
                labels: months,
                datasets: [{
                    label: "Monthly Revenue",
                    data: months.map(m => monthly[m]),
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true
            }
        }
    );

    productChart = new Chart(
        document.getElementById("productChart"),
        {
            type: "bar",
            data: {
                labels: productNames,
                datasets: [{
                    label: "Quantity Sold",
                    data: productNames.map(p => products[p])
                }]
            },
            options: {
                responsive: true
            }
        }
    );
}


// VALIDATION REPORT

function showReport(errors, duplicates, validCount) {
    document.getElementById("report").textContent =
        "Valid records: " + validCount +
        " | Invalid rows: " + errors.length +
        " | Duplicates skipped: " + duplicates;

    const list = document.getElementById("errorList");

    list.innerHTML = "";

    errors.forEach(error => {
        let li = document.createElement("li");
        li.textContent = error;
        list.appendChild(li);
    });
}


// SAMPLE DATA

function loadSample() {
    salesData = [
        {
            product: "Laptop",
            date: "2026-01-10",
            quantity: 2,
            price: 45000,
            region: "South",
            category: "Electronics"
        },
        {
            product: "Phone",
            date: "2026-01-15",
            quantity: 5,
            price: 15000,
            region: "North",
            category: "Electronics"
        },
        {
            product: "Laptop",
            date: "2026-02-05",
            quantity: 3,
            price: 45000,
            region: "South",
            category: "Electronics"
        },
        {
            product: "Headphones",
            date: "2026-02-12",
            quantity: 10,
            price: 2000,
            region: "West",
            category: "Accessories"
        },
        {
            product: "Phone",
            date: "2026-03-08",
            quantity: 8,
            price: 15000,
            region: "North",
            category: "Electronics"
        },
        {
            product: "Headphones",
            date: "2026-03-20",
            quantity: 6,
            price: 2000,
            region: "West",
            category: "Accessories"
        }
    ];

    updateDashboard();

    showReport([], 0, salesData.length);

    document.getElementById("status").textContent =
        "Sample data loaded successfully.";
}


// DOWNLOAD ERROR REPORT

function downloadErrorReport() {
    const errors = document.getElementById("errorList");

    if (errors.children.length === 0) {
        alert("No errors to download!");
        return;
    }

    let report = "Validation Errors\n";

    for (let error of errors.children) {
        report += error.textContent + "\n";
    }

    const blob = new Blob([report], {
        type: "text/plain"
    });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "error-report.txt";

    link.click();

    URL.revokeObjectURL(link.href);
}
