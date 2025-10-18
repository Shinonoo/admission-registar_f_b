// server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- DB CONNECTION ----------------
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "school_db",
});

connection.connect((err) => {
  if (err) throw err;
  console.log("✅ Connected to MySQL");
});

// ---------------- ADD NEW APPLICANT ----------------
app.post("/api/admissions", (req, res) => {
  const {
    first_name,
    middle_name,
    last_name,
    ext_name,
    gender,
    age,
    lrn,
    citizenship,
    religion,
    email,
    phone,
    program,
    year_level,
    admission_date,
    school_year,
    period,
    family_members = [],
    street,
    barangay,
    city,
    province,
  } = req.body;

  // 🧩 Step 1: Get program_id from the programs table
  const programSql = "SELECT id FROM programs WHERE program_name = ?";
  connection.query(programSql, [program], (progErr, progResult) => {
    if (progErr) {
      console.error("❌ Error fetching program:", progErr);
      return res.status(500).json({ error: "Error fetching program." });
    }

    if (progResult.length === 0) {
      return res
        .status(400)
        .json({ error: `Program '${program}' not found in database.` });
    }

    const program_id = progResult[0].id;

    // 🏠 Step 2: Insert address
    const addrSql =
      "INSERT INTO addresses (street, barangay, city, province) VALUES (?, ?, ?, ?)";
    connection.query(
      addrSql,
      [street, barangay, city, province],
      (addrErr, addrResult) => {
        if (addrErr) {
          console.error("❌ Error inserting address:", addrErr);
          return res.status(500).json({ error: "Error inserting address." });
        }

        const address_id = addrResult.insertId;
        const familyData = JSON.stringify(family_members);

        // 🧾 Step 3: Insert applicant
        const appSql = `
          INSERT INTO admission_applications 
          (first_name, middle_name, last_name, ext_name, gender, age, lrn,
           citizenship, religion, email, phone, program_id, address_id,
           year_level, admission_date, school_year, period, family_members, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `;

        const appValues = [
          first_name,
          middle_name,
          last_name,
          ext_name,
          gender,
          age,
          lrn,
          citizenship,
          religion,
          email,
          phone,
          program_id,
          address_id,
          year_level,
          admission_date,
          school_year,
          period,
          familyData,
        ];

        connection.query(appSql, appValues, (appErr, appResult) => {
          if (appErr) {
            console.error("❌ Error inserting applicant:", appErr);
            return res
              .status(500)
              .json({ error: "Error inserting applicant record." });
          }

          const student_id = appResult.insertId;

          // 👨‍👩‍👧 Step 4: Insert family members
          family_members.forEach((member) => {
            const { name, relationship, occupation, contact_number } = member;
            const fmSql = `
              INSERT INTO family_members (student_id, name, relationship, occupation, contact_number)
              VALUES (?, ?, ?, ?, ?)
            `;
            connection.query(
              fmSql,
              [student_id, name, relationship, occupation || "", contact_number],
              (fmErr) => {
                if (fmErr)
                  console.error("❌ Error inserting family member:", fmErr);
              }
            );
          });

          res.json({
            msg: "✅ Applicant and family members added successfully!",
            applicant_id: student_id,
          });
        });
      }
    );
  });
});

// ---------------- ACCEPT APPLICANT ----------------
app.post("/api/admissions/accept", (req, res) => {
  const { id } = req.body;
  const sql = `UPDATE admission_applications SET status='Accepted' WHERE id=?`;

  connection.query(sql, [id], (err) => {
    if (err) throw err;

    const promoteSql = `
      INSERT INTO students (
        application_id, student_no, first_name, middle_name, last_name, ext_name,
        gender, age, lrn, citizenship, religion, email, phone, program_id, address_id
      )
      SELECT 
        a.id, CONCAT('STU', LPAD(a.id, 5, '0')),
        a.first_name, a.middle_name, a.last_name, a.ext_name,
        a.gender, a.age, a.lrn, a.citizenship, a.religion, a.email, a.phone,
        a.program_id, a.address_id
      FROM admission_applications a WHERE a.id=?
    `;
    connection.query(promoteSql, [id], (err2) => {
      if (err2) throw err2;
      res.json({ msg: "✅ Applicant accepted and moved to students table!" });
    });
  });
});

// ---------------- REJECT APPLICANT ----------------
app.post("/api/admissions/reject", (req, res) => {
  const { id, reason = "No reason provided" } = req.body;
  const sql = `UPDATE admission_applications SET status='Rejected' WHERE id=?`;

  connection.query(sql, [id], (err) => {
    if (err) throw err;

    const rejectSql = `
      INSERT INTO rejected_students (
        application_id, reason, first_name, middle_name, last_name, ext_name,
        gender, age, lrn, citizenship, religion, email, phone,
        program_id, address_id, year_level, school_year, period
      )
      SELECT 
        a.id, ?, a.first_name, a.middle_name, a.last_name, a.ext_name,
        a.gender, a.age, a.lrn, a.citizenship, a.religion, a.email, a.phone,
        a.program_id, a.address_id, a.year_level, a.school_year, a.period
      FROM admission_applications a WHERE a.id=?
    `;
    connection.query(rejectSql, [reason, id], (err2) => {
      if (err2) throw err2;
      res.json({ msg: "❌ Applicant rejected and moved to rejected_students table!" });
    });
  });
});


//Registar other routes here...
app.get("/api/students", (req, res) => {
  const sql = `
    SELECT 
      a.id,
      a.first_name,
      a.middle_name,
      a.last_name,
      a.gender,
      a.age,
      a.lrn,
      a.email,
      a.phone,
      a.status,
      a.year_level,
      a.admission_date,
      a.school_year,
      a.period,
      p.program_name AS program,
      CONCAT(ad.street, ', ', ad.barangay, ', ', ad.city, ', ', ad.province) AS address
    FROM admission_applications a
    LEFT JOIN programs p ON a.program_id = p.id
    LEFT JOIN addresses ad ON a.address_id = ad.id
    ORDER BY a.id DESC
  `;

  connection.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching applicants:", err);
      return res.status(500).json({ error: "Error fetching applicants." });
    }
    res.json(results);
  });
});

app.get("/api/students/:id", (req, res) => {
  const id = req.params.id;

  const sql = `
    SELECT 
      a.id,
      a.first_name,
      a.middle_name,
      a.last_name,
      a.ext_name,
      a.gender,
      a.age,
      a.lrn,
      a.citizenship,
      a.religion,
      a.email,
      a.phone,
      p.program_name AS program,
      a.year_level,
      a.admission_date,
      a.school_year,
      a.period,
      a.status,
      ad.street,
      ad.barangay,
      ad.city,
      ad.province
    FROM admission_applications a
    LEFT JOIN programs p ON a.program_id = p.id
    LEFT JOIN addresses ad ON a.address_id = ad.id
    WHERE a.id = ?
  `;

  connection.query(sql, [id], (err, results) => {
    if (err) {
      console.error("❌ SQL Error fetching applicant:", err);
      return res.status(500).json({ error: "Database error while fetching applicant." });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Applicant not found." });
    }

    const applicant = results[0];

    // 🔹 Fetch family members
    const famSql = `
      SELECT 
        id,
        name,
        relationship AS relationship,
        occupation,
        contact_number AS contact_number
      FROM family_members
      WHERE student_id = ?
    `;


    connection.query(famSql, [id], (fmErr, family) => {
      if (fmErr) {
        console.error("❌ Error fetching family members:", fmErr);
        return res.status(500).json({ error: "Error fetching family members." });
      }

      // ✅ Attach the family array to the applicant
      applicant.family_members = family || [];

      res.json(applicant);
    });
  });
});


// ---------------- START SERVER ----------------
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
