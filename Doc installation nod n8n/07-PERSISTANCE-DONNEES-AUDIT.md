# Système de Persistance et Cas d'Usage Audit

## 🎯 Votre Objectif

Créer un système d'audit où :

1. Des **tables sont générées depuis n8n** (workflows d'automatisation)
2. L'utilisateur peut **modifier les données** dans Nod
3. Les modifications sont **persistantes** (sauvegardées)
4. L'utilisateur **retrouve ses données** entre les sessions

---

## 📊 Système de Persistance Actuel de Nod

### Architecture de Base de Données

```
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL (Conteneur Docker)              │
│              Port: 54329 (localhost)                    │
├─────────────────────────────────────────────────────────┤
│  Tables Nod (système) :                                 │
│  ├── turns                  # Historique des messages   │
│  ├── turn_events            # Événements d'exécution   │
│  ├── model_usage            # Coûts et utilisation AI  │
│  ├── preferences            # Paramètres utilisateur   │
│  ├── memory                 # Notes et skills apprises │
│  ├── schedules              # Tâches planifiées        │
│  ├── vault                  # Credentials chiffrés     │
│  └── ...                    # Autres tables système    │
└─────────────────────────────────────────────────────────┘
```

### 🔑 Points Clés de Persistance Actuelle

1. **PostgreSQL Persistant**
   - Volume Docker : Les données survivent aux redémarrages
   - Chemin : Docker volume `nod-local_postgres-data`
   - **Les données NE SONT PAS perdues** quand vous faites `docker compose stop`

2. **Fichiers Locaux Persistants**
   - Dossier : `h:\nod_n8n\.local\` (NOD_DATA_ROOT)
   - Contient : workspaces, clés Vault, cache, etc.
   - **Persiste** entre les sessions

3. **Workspace Éphémère**
   - Le conteneur Workspace est **temporaire**
   - Fichiers dans `/workspace/` sont **perdus** au redémarrage
   - ⚠️ Ne PAS stocker de données importantes ici

---

## 🏗️ Architecture pour Votre Cas d'Usage Audit

### Vision Globale

```
┌──────────────────────────────────────────────────────────────┐
│                     Workflow n8n                             │
│  (Génère des données d'audit depuis sources externes)       │
└────────────────────┬─────────────────────────────────────────┘
                     │ API / Webhook
                     ↓
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL - Schéma Audit                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tables Audit (vos données) :                          │ │
│  │  ├── audit_missions        # Liste des missions       │ │
│  │  ├── audit_findings        # Constatations            │ │
│  │  ├── audit_evidence        # Preuves                  │ │
│  │  ├── audit_recommendations # Recommandations          │ │
│  │  └── audit_reports         # Rapports générés         │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────┘
                     │ SQL / ORM
                     ↓
┌──────────────────────────────────────────────────────────────┐
│              Serveur Nod (Node.js + API)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Routes API Audit :                                    │ │
│  │  • GET  /api/audit/missions        # Lister           │ │
│  │  • POST /api/audit/missions        # Créer            │ │
│  │  • PUT  /api/audit/missions/:id    # Modifier         │ │
│  │  • DELETE /api/audit/missions/:id  # Supprimer        │ │
│  │  • GET  /api/audit/findings        # Constatations    │ │
│  │  • POST /api/audit/findings        # Ajouter          │ │
│  │  • ...                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP
                     ↓
┌──────────────────────────────────────────────────────────────┐
│            Interface Web React (Nod UI)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Composants Audit :                                    │ │
│  │  • AuditDashboard         # Vue d'ensemble            │ │
│  │  • MissionList            # Liste des missions        │ │
│  │  • FindingsTable          # Tableau éditable          │ │
│  │  • EvidenceUpload         # Upload de preuves         │ │
│  │  • ReportGenerator        # Génération rapports       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 💾 Solution 1 : Utiliser PostgreSQL Directement (Recommandé)

### Pourquoi ?

- ✅ **Déjà intégré** dans Nod (PostgreSQL 17)
- ✅ **Persistant** par défaut (volume Docker)
- ✅ **Performant** pour des données structurées
- ✅ **Transactionnel** (ACID)
- ✅ **Compatible n8n** (n8n peut écrire directement dans PostgreSQL)

### Étape 1 : Créer Votre Schéma Audit

Créez un fichier de migration SQL :

**Fichier** : `h:\nod_n8n\migrations\001-audit-schema.sql`

```sql
-- Créer un schéma séparé pour les données d'audit
CREATE SCHEMA IF NOT EXISTS audit;

-- Table des missions d'audit
CREATE TABLE audit.missions (
    id SERIAL PRIMARY KEY,
    mission_code VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    audit_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'in_progress',
    lead_auditor VARCHAR(255),
    team_members TEXT[], -- Array de noms
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB -- Données flexibles additionnelles
);

-- Table des constatations
CREATE TABLE audit.findings (
    id SERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES audit.missions(id) ON DELETE CASCADE,
    finding_code VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    identified_date DATE,
    responsible_party VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Table des preuves
CREATE TABLE audit.evidence (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER REFERENCES audit.findings(id) ON DELETE CASCADE,
    evidence_type VARCHAR(100), -- 'document', 'screenshot', 'log', 'interview'
    file_path TEXT, -- Chemin vers le fichier dans .local/
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    description TEXT,
    collected_date DATE,
    collected_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Table des recommandations
CREATE TABLE audit.recommendations (
    id SERIAL PRIMARY KEY,
    finding_id INTEGER REFERENCES audit.findings(id) ON DELETE CASCADE,
    recommendation_text TEXT NOT NULL,
    priority VARCHAR(50), -- 'urgent', 'high', 'medium', 'low'
    target_date DATE,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    implementation_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Table des rapports générés
CREATE TABLE audit.reports (
    id SERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES audit.missions(id) ON DELETE CASCADE,
    report_type VARCHAR(100), -- 'preliminary', 'final', 'executive_summary'
    generated_date TIMESTAMP DEFAULT NOW(),
    file_path TEXT,
    file_name VARCHAR(255),
    generated_by VARCHAR(255),
    report_data JSONB, -- Contenu structuré du rapport
    metadata JSONB
);

-- Index pour les performances
CREATE INDEX idx_missions_status ON audit.missions(status);
CREATE INDEX idx_missions_dates ON audit.missions(start_date, end_date);
CREATE INDEX idx_findings_mission ON audit.findings(mission_id);
CREATE INDEX idx_findings_severity ON audit.findings(severity);
CREATE INDEX idx_findings_status ON audit.findings(status);
CREATE INDEX idx_evidence_finding ON audit.evidence(finding_id);
CREATE INDEX idx_recommendations_finding ON audit.recommendations(finding_id);

-- Fonction de mise à jour automatique du timestamp
CREATE OR REPLACE FUNCTION audit.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_missions_updated_at
    BEFORE UPDATE ON audit.missions
    FOR EACH ROW EXECUTE FUNCTION audit.update_updated_at_column();

CREATE TRIGGER update_findings_updated_at
    BEFORE UPDATE ON audit.findings
    FOR EACH ROW EXECUTE FUNCTION audit.update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at
    BEFORE UPDATE ON audit.recommendations
    FOR EACH ROW EXECUTE FUNCTION audit.update_updated_at_column();

-- Vue pour un aperçu complet des missions
CREATE VIEW audit.missions_overview AS
SELECT
    m.id,
    m.mission_code,
    m.client_name,
    m.status,
    COUNT(DISTINCT f.id) as total_findings,
    COUNT(DISTINCT CASE WHEN f.severity = 'critical' THEN f.id END) as critical_findings,
    COUNT(DISTINCT CASE WHEN f.status = 'open' THEN f.id END) as open_findings,
    COUNT(DISTINCT e.id) as total_evidence,
    m.start_date,
    m.end_date
FROM audit.missions m
LEFT JOIN audit.findings f ON m.id = f.mission_id
LEFT JOIN audit.evidence e ON f.id = e.finding_id
GROUP BY m.id;

-- Droits d'accès
GRANT USAGE ON SCHEMA audit TO nod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO nod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO nod;
```

### Étape 2 : Exécuter la Migration

```powershell
# Se connecter à PostgreSQL et exécuter le script
docker compose exec postgres psql -U nod -d nod -f /migrations/001-audit-schema.sql

# Ou directement :
$env:PGPASSWORD="B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS"
Get-Content migrations\001-audit-schema.sql | docker compose exec -T postgres psql -U nod -d nod
```

### Étape 3 : Créer l'API Backend (Serveur Nod)

**Fichier** : `src/server/routes/audit.ts`

```typescript
import { Router } from 'express';
import { db } from '../db'; // Votre client DB

export const auditRouter = Router();

// ============================================
// MISSIONS
// ============================================

// Liste toutes les missions
auditRouter.get('/missions', async (req, res) => {
  try {
    const missions = await db.query(`
      SELECT * FROM audit.missions_overview
      ORDER BY start_date DESC
    `);
    res.json({ success: true, data: missions.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtenir une mission spécifique
auditRouter.get('/missions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mission = await db.query('SELECT * FROM audit.missions WHERE id = $1', [id]);

    if (mission.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mission not found' });
    }

    res.json({ success: true, data: mission.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer une nouvelle mission
auditRouter.post('/missions', async (req, res) => {
  try {
    const {
      mission_code,
      client_name,
      audit_type,
      start_date,
      end_date,
      lead_auditor,
      team_members,
      metadata,
    } = req.body;

    const result = await db.query(
      `
      INSERT INTO audit.missions 
        (mission_code, client_name, audit_type, start_date, end_date, lead_auditor, team_members, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        mission_code,
        client_name,
        audit_type,
        start_date,
        end_date,
        lead_auditor,
        team_members,
        metadata,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modifier une mission
auditRouter.put('/missions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Construction dynamique de la requête UPDATE
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await db.query(
      `
      UPDATE audit.missions 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `,
      values,
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer une mission
auditRouter.delete('/missions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM audit.missions WHERE id = $1', [id]);
    res.json({ success: true, message: 'Mission deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FINDINGS (Constatations)
// ============================================

// Liste les constatations d'une mission
auditRouter.get('/missions/:missionId/findings', async (req, res) => {
  try {
    const { missionId } = req.params;
    const findings = await db.query(
      `
      SELECT f.*, 
        COUNT(e.id) as evidence_count,
        COUNT(r.id) as recommendations_count
      FROM audit.findings f
      LEFT JOIN audit.evidence e ON f.id = e.finding_id
      LEFT JOIN audit.recommendations r ON f.id = r.finding_id
      WHERE f.mission_id = $1
      GROUP BY f.id
      ORDER BY f.identified_date DESC
    `,
      [missionId],
    );

    res.json({ success: true, data: findings.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer une constatation
auditRouter.post('/findings', async (req, res) => {
  try {
    const {
      mission_id,
      finding_code,
      title,
      description,
      severity,
      category,
      identified_date,
      responsible_party,
      metadata,
    } = req.body;

    const result = await db.query(
      `
      INSERT INTO audit.findings 
        (mission_id, finding_code, title, description, severity, category, 
         identified_date, responsible_party, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        mission_id,
        finding_code,
        title,
        description,
        severity,
        category,
        identified_date,
        responsible_party,
        metadata,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modifier une constatation
auditRouter.put('/findings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await db.query(
      `
      UPDATE audit.findings 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `,
      values,
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer une constatation
auditRouter.delete('/findings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM audit.findings WHERE id = $1', [id]);
    res.json({ success: true, message: 'Finding deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EVIDENCE (Preuves)
// ============================================

// Liste les preuves d'une constatation
auditRouter.get('/findings/:findingId/evidence', async (req, res) => {
  try {
    const { findingId } = req.params;
    const evidence = await db.query(
      'SELECT * FROM audit.evidence WHERE finding_id = $1 ORDER BY collected_date DESC',
      [findingId],
    );
    res.json({ success: true, data: evidence.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ajouter une preuve
auditRouter.post('/evidence', async (req, res) => {
  try {
    const {
      finding_id,
      evidence_type,
      file_path,
      file_name,
      file_size,
      mime_type,
      description,
      collected_date,
      collected_by,
      metadata,
    } = req.body;

    const result = await db.query(
      `
      INSERT INTO audit.evidence 
        (finding_id, evidence_type, file_path, file_name, file_size, mime_type,
         description, collected_date, collected_by, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
      [
        finding_id,
        evidence_type,
        file_path,
        file_name,
        file_size,
        mime_type,
        description,
        collected_date,
        collected_by,
        metadata,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export complet (CSV, JSON, Excel)
auditRouter.get('/missions/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    // Récupérer toutes les données de la mission
    const mission = await db.query('SELECT * FROM audit.missions WHERE id = $1', [id]);
    const findings = await db.query('SELECT * FROM audit.findings WHERE mission_id = $1', [id]);
    const evidence = await db.query(
      `
      SELECT e.* FROM audit.evidence e
      JOIN audit.findings f ON e.finding_id = f.id
      WHERE f.mission_id = $1
    `,
      [id],
    );
    const recommendations = await db.query(
      `
      SELECT r.* FROM audit.recommendations r
      JOIN audit.findings f ON r.finding_id = f.id
      WHERE f.mission_id = $1
    `,
      [id],
    );

    const exportData = {
      mission: mission.rows[0],
      findings: findings.rows,
      evidence: evidence.rows,
      recommendations: recommendations.rows,
    };

    if (format === 'json') {
      res.json({ success: true, data: exportData });
    } else {
      // TODO: Implémenter CSV/Excel export
      res.status(501).json({ error: 'Format not implemented yet' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Enregistrer la route** dans `src/server/index.ts` :

```typescript
import { auditRouter } from './routes/audit';

// ...

app.use('/api/audit', auditRouter);
```

### Étape 4 : Interface Web React

**Fichier** : `src/web/pages/audit-dashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Mission {
  id: number;
  mission_code: string;
  client_name: string;
  status: string;
  total_findings: number;
  critical_findings: number;
  start_date: string;
}

export const AuditDashboard: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      const response = await api.get('/api/audit/missions');
      setMissions(response.data.data);
    } catch (error) {
      console.error('Erreur chargement missions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="audit-dashboard">
      <h1>Tableau de Bord Audit</h1>

      <div className="missions-grid">
        {missions.map(mission => (
          <div key={mission.id} className="mission-card">
            <h3>{mission.mission_code}</h3>
            <p>{mission.client_name}</p>
            <div className="mission-stats">
              <span>Constatations: {mission.total_findings}</span>
              <span className="critical">Critiques: {mission.critical_findings}</span>
            </div>
            <span className={`status status-${mission.status}`}>
              {mission.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Fichier** : `src/web/components/findings-table.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Finding {
  id: number;
  finding_code: string;
  title: string;
  severity: string;
  status: string;
}

interface FindingsTableProps {
  missionId: number;
}

export const FindingsTable: React.FC<FindingsTableProps> = ({ missionId }) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    loadFindings();
  }, [missionId]);

  const loadFindings = async () => {
    const response = await api.get(`/api/audit/missions/${missionId}/findings`);
    setFindings(response.data.data);
  };

  const updateFinding = async (id: number, updates: Partial<Finding>) => {
    await api.put(`/api/audit/findings/${id}`, updates);
    loadFindings(); // Recharger
  };

  const deleteFinding = async (id: number) => {
    if (confirm('Supprimer cette constatation ?')) {
      await api.delete(`/api/audit/findings/${id}`);
      loadFindings();
    }
  };

  return (
    <table className="findings-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Titre</th>
          <th>Sévérité</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {findings.map(finding => (
          <tr key={finding.id}>
            <td>{finding.finding_code}</td>
            <td>
              {editing === finding.id ? (
                <input
                  value={finding.title}
                  onChange={(e) => {
                    // Update local state
                    const updated = findings.map(f =>
                      f.id === finding.id ? { ...f, title: e.target.value } : f
                    );
                    setFindings(updated);
                  }}
                />
              ) : (
                finding.title
              )}
            </td>
            <td>
              <select
                value={finding.severity}
                onChange={(e) => updateFinding(finding.id, { severity: e.target.value })}
              >
                <option value="critical">Critique</option>
                <option value="high">Élevé</option>
                <option value="medium">Moyen</option>
                <option value="low">Faible</option>
              </select>
            </td>
            <td>{finding.status}</td>
            <td>
              {editing === finding.id ? (
                <button onClick={() => {
                  updateFinding(finding.id, { title: finding.title });
                  setEditing(null);
                }}>
                  Sauvegarder
                </button>
              ) : (
                <>
                  <button onClick={() => setEditing(finding.id)}>Éditer</button>
                  <button onClick={() => deleteFinding(finding.id)}>Supprimer</button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## 🔌 Intégration avec n8n

### Workflow n8n → PostgreSQL

**Exemple de workflow n8n** :

```json
{
  "nodes": [
    {
      "name": "Trigger - Webhook",
      "type": "n8n-nodes-base.webhook",
      "webhookId": "audit-mission-create"
    },
    {
      "name": "PostgreSQL - Insert Mission",
      "type": "n8n-nodes-base.postgres",
      "credentials": "nodPostgres",
      "operation": "insert",
      "schema": "audit",
      "table": "missions",
      "columns": ["mission_code", "client_name", "audit_type", "start_date"],
      "values": {
        "mission_code": "={{ $json.code }}",
        "client_name": "={{ $json.client }}",
        "audit_type": "={{ $json.type }}",
        "start_date": "={{ $json.date }}"
      }
    }
  ]
}
```

### Configuration n8n pour accéder à votre PostgreSQL

Dans n8n, créer une connexion PostgreSQL :

- **Host** : `localhost` (si n8n tourne sur votre machine)
- **Port** : `54329`
- **Database** : `nod`
- **User** : `nod`
- **Password** : `B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS`
- **Schema** : `audit`

---

## 💾 Solution 2 : Fichiers JSON/SQLite dans .local/ (Alternative)

Si vous préférez des fichiers locaux pour plus de simplicité :

### Structure

```
h:\nod_n8n\.local\
└── audit-data\
    ├── missions\
    │   ├── MISS-2026-001.json
    │   ├── MISS-2026-002.json
    │   └── ...
    ├── findings\
    │   ├── FIND-001.json
    │   └── ...
    └── audit.db  # SQLite database
```

### API avec Fichiers JSON

```typescript
import fs from 'fs/promises';
import path from 'path';

const DATA_ROOT = process.env.NOD_DATA_ROOT || '.local';
const AUDIT_DIR = path.join(DATA_ROOT, 'audit-data', 'missions');

// Créer un dossier si inexistant
await fs.mkdir(AUDIT_DIR, { recursive: true });

// Lire toutes les missions
export async function getAllMissions() {
  const files = await fs.readdir(AUDIT_DIR);
  const missions = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => {
        const content = await fs.readFile(path.join(AUDIT_DIR, f), 'utf-8');
        return JSON.parse(content);
      }),
  );
  return missions;
}

// Sauvegarder une mission
export async function saveMission(mission: Mission) {
  const filePath = path.join(AUDIT_DIR, `${mission.mission_code}.json`);
  await fs.writeFile(filePath, JSON.stringify(mission, null, 2), 'utf-8');
}

// Mettre à jour une mission
export async function updateMission(code: string, updates: Partial<Mission>) {
  const filePath = path.join(AUDIT_DIR, `${code}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  const mission = JSON.parse(content);
  const updated = { ...mission, ...updates, updated_at: new Date().toISOString() };
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
```

---

## 🎯 Recommandation Finale

### Pour Votre Cas d'Usage Audit, je recommande :

**✅ Solution 1 : PostgreSQL** car :

1. **Déjà intégré** dans Nod (pas de setup additionnel)
2. **Performant** pour des requêtes complexes (JOINs, aggregations)
3. **Transactionnel** (rollback si erreur)
4. **Compatible n8n** directement
5. **Relationnel** (missions → findings → evidence)
6. **Scalable** (des milliers de missions sans problème)

### Architecture Recommandée

```
n8n → PostgreSQL (schéma audit) → API Nod → React UI
      ↑           ↑
      └───────────┴─ Même base de données, schémas séparés
```

---

## 📋 Checklist d'Implémentation

- [ ] Créer le schéma SQL `audit`
- [ ] Exécuter la migration dans PostgreSQL
- [ ] Créer les routes API dans `src/server/routes/audit.ts`
- [ ] Enregistrer la route dans `src/server/index.ts`
- [ ] Créer les composants React
  - [ ] AuditDashboard
  - [ ] MissionList
  - [ ] FindingsTable
  - [ ] EvidenceUpload
- [ ] Configurer n8n pour écrire dans PostgreSQL
- [ ] Tester le cycle complet :
  - [ ] n8n crée une mission
  - [ ] Affichage dans Nod UI
  - [ ] Modification dans Nod UI
  - [ ] Données persistées après redémarrage

---

## 🚀 Prochaines Étapes

1. **Terminer l'installation** de Nod (build Docker en cours)
2. **Tester** PostgreSQL fonctionne
3. **Créer** le schéma audit
4. **Implémenter** l'API backend
5. **Développer** l'interface React
6. **Intégrer** avec n8n

**Besoin d'aide pour une étape spécifique ?** 🎯
