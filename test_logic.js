
const parseCSV = (text) => {
    // Standardize line endings and filter truly empty or whitespace-only lines
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '' && line.replace(/[,;]/g, '').trim() !== '');
    if (lines.length < 2) return [];

    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || "";
        });
        return obj;
    }).filter(record => {
        // Basic check: at least one field should have meaningful data
        return Object.values(record).some(val => val !== "");
    });
};

const validateNomina = (data) => {
    const hasName = data.nombreApellido && data.nombreApellido.length > 1;
    const hasCuil = data.cuil && data.cuil.length > 5;
    return hasName && hasCuil;
};

// TEST CASES
const csvInput = `Nombre_Apellido;CUIL;Remuneracion
Juan Perez;20-12345678-9;1000
;;
 ; ; 
Maria Lopez;27-98765432-1;2000
; ;0
`;

console.log("--- TEST: parseCSV ---");
const records = parseCSV(csvInput);
console.log("Records found by parser:", records.length);

console.log("\n--- TEST: Validation (Filtering) ---");
const validRecords = [];
const invalidRecords = [];

records.forEach((r, i) => {
    const data = {
        nombreApellido: r.Nombre_Apellido,
        cuil: r.CUIL
    };
    if (validateNomina(data)) {
        validRecords.push(r);
    } else {
        invalidRecords.push(r);
    }
});

console.log("Valid records (to be imported):", validRecords.length);
validRecords.forEach(r => console.log(` - OK: ${r.Nombre_Apellido}`));

console.log("Invalid records (to be skipped):", invalidRecords.length);
invalidRecords.forEach(r => console.log(` - SKIP: Record with CUIL "${r.CUIL}" and Name "${r.Nombre_Apellido}"`));

if (validRecords.length === 2 && invalidRecords.length === 1) {
    console.log("\nSUCCESS: Logic validated. 2 distinct people to import, 1 garbage record skipped.");
} else {
    console.log("\nFAILURE: Logic issue detected.");
    process.exit(1);
}
