'use client';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ── Mock data ──────────────────────────────────────────────────────────────
// `system` rows mirror Darwinbox's built-in metadata (no edit/delete control).
// `dateLocked` means the "Set as date" checkbox is rendered disabled because
// the platform owns that flag for `ft:*` keys.
const SEED = [
  { key: 'audience',                       values: [],                                                                                                                          indexed: true,  isDate: false, system: false, dateLocked: false },
  { key: 'author_personname',              values: ['Darwinbox','Debapriya Hajara','Lenin Elvira','Nilanjan Guha','Payal Tikait','Praseeda Udaykumar','Rashmi Menon','Shikha Gheyee','Shivani Kothakapu','Srilakshmi TVN'], indexed: true,  isDate: false, system: true,  dateLocked: false },
  { key: 'authorgroup_author_personname',  values: ['Prem Garudadri'],                                                                                                          indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'category',                       values: [],                                                                                                                          indexed: false, isDate: false, system: false, dateLocked: false },
  { key: 'copyright',                      values: ['Holder','Shivani Kothakapu'],                                                                                              indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'Created_by',                     values: ['633198969b32cfef932661c2 (Aug 05, 2024)','633198969b32cfef932661c2 (Feb 01, 2023)','633198969b32cfef932661c2 (Jun 05, 2024)','712020:2206c7be-c4c2-423e-8fe8-9bfb6b235ba3 (Sep 04, 2024)'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'creationDate',                   values: ['2022-04-01','2022-04-04','2022-04-05','2022-04-06','2022-04-07','2022-04-11','2022-04-12','2022-04-19','2022-05-11','2022-05-16'],  indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'data_origin_id',                 values: ['UUID-0005f267-43e7-9dac-97e1-12193c4e45ef','UUID-00086742-2877-5551-5f5c-d70d98185b14','UUID-00119b36-e6ba-64bc-4d31-28acbddd4659','UUID-001279ac-8e3d-e151-140c-62c09cdade11','UUID-001f610d-9c65-0e0a-423b-56af5ed8f3aa','UUID-0021adf2-3f2b-5ab2-326e-99385c889067','UUID-00238349-786a-ecd2-b304-d2d0783b08d4','UUID-0037fed5-0567-a6f1-e50a-92072392bc16','UUID-00424af7-6080-b74c-81f2-0f6f35b15ad7','UUID-004b3ea7-0b7e-f158-d3fc-fcab1c43173d'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'data_time_modified',             values: [],                                                                                                                          indexed: false, isDate: false, system: false, dateLocked: false },
  { key: 'datatimemodified',               values: [],                                                                                                                          indexed: false, isDate: false, system: false, dateLocked: false },
  { key: 'ft:alertTimestamp',              values: ['1667433600','1667520000','1667779200','1668643200','1668729600','1669248000','1670457600','1673395200','1673827200','1674777600'], indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:attachmentsSize',             values: ['0'],                                                                                                                       indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:baseId',                      values: ["'Click-Here'-option-in-Emails-Not-Working_4415356964.html",'#Alabama-Absence&LeaveManagement','#Alabama-Attendance','#Alabama-Overtime','#Alaska-Absence&LeaveManagement','#Alaska-Attendance','#Alaska-HolidayCalendar','#Alaska-Overtime','#Arizona-Absence&LeaveManagement','#Arizona-Attendance'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:clusterId',                   values: ["'Click-Here'-option-in-Emails-Not-Working_4415356964.html",'#Alabama-Absence&LeaveManagement','#Alabama-Attendance','#Alabama-Overtime','#Alaska-Absence&LeaveManagement','#Alaska-Attendance','#Alaska-HolidayCalendar','#Alaska-Overtime','#Arizona-Absence&LeaveManagement','#Arizona-Attendance'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:container',                   values: ['book'],                                                                                                                    indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:contentSize',                 values: ['0','100151','10051284','1118795','118626','12801950','13496505','142331','144219','14492757'],                              indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:document_type',               values: ['document','map','topic'],                                                                                                  indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:editorialType',               values: ['book'],                                                                                                                    indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:filename',                    values: ['AI Accelerator Pack + Knowledge Management Platform .pdf','Ask Darwin Sense AI.pdf','Carry forward communication_FAQs.pdf','ClearTax_file_ITR.pdf','Darwinbox AI Accelerator Pack.pdf','Darwinbox Workflows Okta.pdf','Darwinbox_AI_Pack-en.pdf','Darwinbox_Entra_Fields_Mapping.xlsx','Darwinbox_Entra_Permissions_Mapping 1.xlsx','Darwinbox_Entra_SCIM_Domain_Mapping 2.xlsx'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:isArticle',                   values: ['false'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isAttachment',                values: ['false'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isBook',                      values: ['false','true'],                                                                                                            indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isHtmlPackage',               values: ['false'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isPublication',               values: ['false','true'],                                                                                                            indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isSynchronousAttachment',     values: ['false'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:isUnstructured',              values: ['false','true'],                                                                                                            indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:khubVersion',                 values: ['5.0.214','5.0.218','5.0.219','5.1.0','5.1.3','5.1.4','5.1.5','5.1.6'],                                                     indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:lastEdition',                 values: ['2022-11-03','2022-11-04','2022-11-07','2022-11-17','2022-11-18','2022-11-24','2022-12-08','2023-01-11','2023-01-16','2023-01-27'], indexed: true,  isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:lastPublication',             values: ['2023-05-24 13:18','2023-07-24 10:25','2023-11-09 09:39','2024-01-23 07:45','2024-02-19 13:31','2024-03-19 07:22','2024-06-26 14:24','2024-09-26 13:08','2024-09-26 13:56','2024-09-26 14:16'], indexed: true, isDate: false, system: true, dateLocked: true },
  { key: 'ft:lastTechChange',              values: ['2026-03-11','2026-03-16','2026-03-18','2026-03-23','2026-03-24','2026-03-25','2026-04-01','2026-04-02','2026-04-03','2026-04-06'], indexed: true,  isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:lastTechChangeTimestamp',     values: ['1773222558712','1773222558759','1773222558793','1773222558829','1773222558870','1773222558905','1773222558947','1773222558982','1773222559018','1773222559051'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:locale',                      values: ['en-US'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:mimeType',                    values: ['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],                                     indexed: true,  isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:openMode',                    values: ['fluidtopics'],                                                                                                             indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:originId',                    values: ["'Click-Here'-option-in-Emails-Not-Working_4415356964.html",'#Alabama-Absence&LeaveManagement','#Alabama-Attendance','#Alabama-Overtime','#Alaska-Absence&LeaveManagement','#Alaska-Attendance','#Alaska-HolidayCalendar','#Alaska-Overtime','#Arizona-Absence&LeaveManagement','#Arizona-Attendance'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:prettyUrl',                   values: ['100-Features','100-Features/1.-Unlocking-seamless-collaboration-with-customized-Universal-Search.','100-Features/10.-Navigating-change-seamlessly-Position-migration-during-organizational-restructuring','100-Features/100.-Availability-of-statutory-and-regular-payroll-reports','100-Features/11.-Delegation-of-tasks','100-Features/12.-Custom-Workflow-Suite-Elevating-Efficiency-and-Empowering-Experiences','100-Features/13.-Streamlining-Onboarding-Assigning-Employee-IDs-Before-Joining-Date','100-Features/14.-Reordering-Employee-Profile-Fields','100-Features/15.-Manage-compensation-positioning.','100-Features/16.-Hybrid-logins'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:publication_title',           values: ['100 Features','AI Accelerator Pack + Knowledge Management Platform .pdf','Ask Darwin Sense AI.pdf','Attendance','Best Practices','Carry forward communication_FAQs.pdf','ClearTax_file_ITR.pdf','Company','Continuous Feedback','Country Guide'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:publicationId',               values: ['~GvS~aKyKXQFTE7WaN818w','~Vgvaejvg7ZwpSWk5f5Ibg','~WSvlIYi1q4bVa5Eh8NBJQ','0h5nz0Mm01DxhH8Lbz8ikA','0ikz~uOJDmeHDM~rMrGl7Q','1l_x7vq~Y6n71rEAo_hnxw','2lZ_zVdHVzPZeGDHYcC3hg','37ogNuIqeVRCQ6wrpYoY1Q','3R6qRJ6LbB_yHkHCTN~1AA','6tl8vtrCWC2trQQoHSo9Gg'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:publishStatus',               values: ['visible'],                                                                                                                 indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:publishUploadId',             values: ['02f1cc4b-01a3-4c69-aca3-6eededd8d09a','092a617c-2dc1-45b5-b89e-68c5a7314585','0a5da719-0234-4c8b-975f-858a05505bdc','11abdd9e-337b-4c42-b974-8b18b1cdd646','1aec9a36-7c6f-46d2-a4f5-f05881aad93c','1b478103-16e3-4627-a05b-130c8c85765a','22e6b47e-9a9d-4932-82cb-1ec53c6dbe1c','24b6ea4e-b243-43ed-bf34-244fb3a3645b','288e0d6d-638a-4ede-b4c3-4ce952846ac8','2933a0fc-da01-472f-a6a7-ce6987878f2f'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:searchableFromInt',           values: ['0'],                                                                                                                       indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:sourceCategory',              values: ['Confluence'],                                                                                                              indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:sourceId',                    values: ['Confluence','Paligo','ud'],                                                                                                indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:sourceName',                  values: ['Confluence','Paligo','UD'],                                                                                                indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:sourceType',                  values: ['Confluence','Paligo','UnstructuredDocuments'],                                                                              indexed: true,  isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:structure',                   values: ['structured','unstructured'],                                                                                                indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:title',                       values: ['.csv UTF-8 in Export to handle MLF Inputs',"'Click Here' option in Emails Not Working",'"Limit Exceeded" Error in the API Response','"New probation period cannot be less than current probation period" Error.','"Not Allowed to Use This API"','"Other Reason" Option Displayed in Separation Forms','"Policy Not Assigned" Error in Reimbursement Module','"Replacement employee found at requisition ___" - Error while raising requisition','01 — Login API','02 — Check Token API'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:tocPosition',                 values: ['1','2','3','4','5','6','7','8','9','10'],                                                                                  indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'ft:topicTitle',                  values: ['.csv UTF-8 in Export to handle MLF Inputs',"'Click Here' option in Emails Not Working",'"Limit Exceeded" Error in the API Response','"New probation period cannot be less than current probation period" Error.','"Not Allowed to Use This API"','"Other Reason" Option Displayed in Separation Forms','"Policy Not Assigned" Error in Reimbursement Module','"Replacement employee found at requisition ___" - Error while raising requisition','01 — Login API','02 — Check Token API'], indexed: false, isDate: false, system: true, dateLocked: true },
  { key: 'ft:wordCount',                   values: ['1','2','3','4','5','6','7','8','9','10'],                                                                                  indexed: false, isDate: false, system: true,  dateLocked: true  },
  { key: 'generator',                      values: ['Paligo'],                                                                                                                  indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'Key',                            values: ['CG','CS','DFA','RA1'],                                                                                                     indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'lastmodifiedby',                 values: [],                                                                                                                          indexed: true,  isDate: false, system: false, dateLocked: false },
  { key: 'Modified',                       values: [],                                                                                                                          indexed: true,  isDate: false, system: false, dateLocked: false },
  { key: 'Module',                         values: ['Attendance','Company','Continous Feedback','Custom Field','Darwinbox Studio','Employees','Engagement','FaaS','Flows','Form builder'],   indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'Name',                           values: ['100 Features','Country Guide','Darwinbox FAQs Articles','Darwinbox Troubleshooting Articles'],                              indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'paligo:resourceTitle',           values: ['.csv UTF-8 in Export to Handle MLF Inputs','401 Error While Logging into Darwinbox','Aadhaar Number Masking',"Ability for Admin to 'Proxy User' using Same Login",'Ability for Permission Role Holders to Share Reports','Ability to Add Custom Dates as SLA duration','Ability to Add Functional Area Head as an Approver or Assignee','Ability to Add Reason when Archiving Positions','Ability to Add SLA Level Name in the SLA Settings','Ability to Add Standard Flows as Subflows'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'paligo:resourceTitleLabel',      values: ['JFM24'],                                                                                                                   indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'publicationDate',                values: ['2024-09-26','2025-03-21','2025-04-23','2025-05-05','2025-06-03','2025-08-09','2025-10-16','2025-10-21','2025-11-19','2025-12-17'], indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'Release_Notes',                  values: ['Release Notes'],                                                                                                           indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'role',                           values: [],                                                                                                                          indexed: false, isDate: false, system: false, dateLocked: false },
  { key: 'subtitle',                       values: ['User Manual'],                                                                                                             indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'Taxonomy',                       values: ['Module > Attendance','Module > Company','Module > Continous Feedback','Module > Custom Field','Module > Darwinbox Studio','Module > Employees','Module > Engagement','Module > FaaS','Module > Flows','Module > Form builder'], indexed: true, isDate: false, system: true, dateLocked: false },
  { key: 'title',                          values: [],                                                                                                                          indexed: true,  isDate: false, system: false, dateLocked: false },
  { key: 'ud:id',                          values: ['AI Accelerator Pack + Knowledge Management Platform .pdf','Ask Darwin Sense AI.pdf','Carry forward communication_FAQs.pdf','ClearTax_file_ITR.pdf','Darwinbox AI Accelerator Pack.pdf','Darwinbox Workflows Okta.pdf','Darwinbox_AI_Pack-en.pdf','Darwinbox_Entra_Fields_Mapping.xlsx','Darwinbox_Entra_Permissions_Mapping 1.xlsx','Darwinbox_Entra_SCIM_Domain_Mapping 2.xlsx'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'xinfo:branched_topic_id',        values: ['51383','56843','8484'],                                                                                                    indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:branched_topic_uuid',      values: ['UUID-cbe9b300-4627-0e43-63b2-d8859271b936','UUID-d68ce587-47d5-a369-0842-aa225139a062','UUID-dac9ca29-36d8-bed0-5a71-54059df438cc'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'xinfo:contribution_editable',    values: ['true'],                                                                                                                    indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:document_id',              values: ['12144','12706','12708','12710','13594','15827','15835','15867','15870'],                                                   indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:linktype',                 values: ['ResourceLink'],                                                                                                            indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:origin',                   values: ['UUID-0005f267-43e7-9dac-97e1-12193c4e45ef','UUID-00086742-2877-5551-5f5c-d70d98185b14','UUID-00119b36-e6ba-64bc-4d31-28acbddd4659','UUID-001279ac-8e3d-e151-140c-62c09cdade11','UUID-001f610d-9c65-0e0a-423b-56af5ed8f3aa','UUID-0021adf2-3f2b-5ab2-326e-99385c889067','UUID-00238349-786a-ecd2-b304-d2d0783b08d4','UUID-0037fed5-0567-a6f1-e50a-92072392bc16','UUID-00424af7-6080-b74c-81f2-0f6f35b15ad7','UUID-004b3ea7-0b7e-f158-d3fc-fcab1c43173d'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'xinfo:origin_id',                values: ['100018','1000308','1000314','100075','1000785','1000791','1000971','100133','10015','100163'],                              indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:pagebreak',                values: ['after','before'],                                                                                                          indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:taxonomy',                 values: ['selected-categories-770106','taxonomy_module_attendance_lvl0 selected-categories-764401','taxonomy_module_attendance_lvl0 taxonomy_module_company_lvl0 taxonomy_module_custom-field_lvl0 …','taxonomy_module_company_lvl0 selected-categories-764402','taxonomy_module_company_lvl0 taxonomy_module_employees_lvl0 selected-categories-764402-770035','taxonomy_module_company_lvl0 taxonomy_module_employees_lvl0 taxonomy_module_flows_lvl0 selected-categories-764402-770035-770037','taxonomy_module_continous-feedback_lvl0 selected-categories-770054','taxonomy_module_custom-field_lvl0 selected-categories-770052','taxonomy_module_darwinbox-studio_lvl0 selected-categories-770058','taxonomy_module_employees_lvl0 selected-categories-770035'], indexed: false, isDate: false, system: true, dateLocked: false },
  { key: 'xinfo:version_major',            values: ['1'],                                                                                                                       indexed: false, isDate: false, system: true,  dateLocked: false },
  { key: 'xinfo:version_minor',            values: ['0'],                                                                                                                       indexed: false, isDate: false, system: true,  dateLocked: false },
];

export default function MetadataConfigPage() {
  const [savedRows, setSavedRows] = useState(SEED);
  const [rows,      setRows]      = useState(SEED);
  const [query,     setQuery]     = useState('');
  const [sortDir,   setSortDir]   = useState('asc');
  const [editing,   setEditing]   = useState(null);
  const [confirm,   setConfirm]   = useState(null);

  const dirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(savedRows),
    [rows, savedRows],
  );

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? rows.filter((r) => r.key.toLowerCase().includes(q)) : rows;
    list = [...list].sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));
    if (sortDir === 'desc') list.reverse();
    return list;
  }, [rows, query, sortDir]);

  const toggleField = (key, field) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: !r[field] } : r)));
  };

  const upsertRow = (draft) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === draft.key);
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = { ...copy[idx], ...draft }; return copy;
      }
      return [...prev, { ...draft, values: [], system: false, dateLocked: false }];
    });
    setEditing(null);
  };
  const deleteRow = (row) => setRows((prev) => prev.filter((r) => r.key !== row.key));

  const onSaveAndReprocess = () => {
    setSavedRows(rows);
    // In production this would also kick off a reprocess job.
  };
  const onCancel = () => setRows(savedRows);

  return (
    <AdminShell active="khub-metadata" allowedRoles={['superadmin']}>
      <div style={S.page}>
        <header style={S.headerRow}>
          <div>
            <h1 style={S.h1}>Metadata configuration</h1>
            <p style={S.subtitle}>Choose which metadata should be indexed and define metadata to be set as dates.</p>
          </div>
          <button type="button" style={S.primaryBtn} onClick={() => setEditing('new')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
            <span>New metadata</span>
          </button>
        </header>

        <div style={S.filterBar}>
          <label htmlFor="metadata-search" style={S.filterLabel}>Search</label>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <span aria-hidden="true" style={S.searchIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="metadata-search"
              type="search"
              placeholder="metadata_key"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={S.searchInput}
            />
          </div>
          <span style={S.resultCount}>{filteredSorted.length} {filteredSorted.length === 1 ? 'result' : 'results'}</span>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <colgroup>
              <col style={{ width: '24%' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Key
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                         aria-hidden="true"
                         style={{
                           transition: 'transform 150ms',
                           transform: sortDir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                         }}>
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </span>
                </th>
                <th style={S.th}>Values</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Index values</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Set as date</th>
                <th style={{ ...S.th, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={5} style={S.emptyCell}>No metadata matches the current search.</td>
                </tr>
              ) : filteredSorted.map((r) => (
                <tr key={r.key} style={S.tr}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.84rem', color: '#0f172a' }}>{r.key}</td>
                  <td style={S.td}><ValueChips values={r.values} /></td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <Checkbox checked={r.indexed} onChange={() => toggleField(r.key, 'indexed')} />
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <Checkbox
                      checked={r.isDate}
                      disabled={r.dateLocked}
                      onChange={() => !r.dateLocked && toggleField(r.key, 'isDate')}
                    />
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!r.system && (
                      <>
                        <IconBtn title="Edit metadata" onClick={() => setEditing(r)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                          </svg>
                        </IconBtn>
                        <IconBtn title="Delete metadata" danger onClick={() => setConfirm({ kind: 'delete', row: r })}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                          </svg>
                        </IconBtn>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.actionsBar}>
          <button
            type="submit"
            disabled={!dirty}
            onClick={onSaveAndReprocess}
            style={{
              ...S.primaryBtn,
              background: dirty ? '#16a34a' : '#e2e8f0',
              color: dirty ? '#fff' : '#94a3b8',
              border: dirty ? '1px solid #16a34a' : '1px solid #e2e8f0',
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Save and reprocess</span>
          </button>
          <button type="button" onClick={onCancel} style={S.secondaryBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>

      <MetadataModal
        open={!!editing}
        existingKeys={rows.map((r) => r.key)}
        editing={editing && editing !== 'new' ? editing : null}
        onCancel={() => setEditing(null)}
        onSave={upsertRow}
      />

      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title={confirm?.row ? `Delete "${confirm.row.key}"?` : ''}
        body="The metadata key will be removed from the configuration. Save and reprocess to apply the change."
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm?.row) deleteRow(confirm.row); setConfirm(null); }}
      />
    </AdminShell>
  );
}

// ── Value chip strip with truncation + +n indicator ────────────────────────
function ValueChips({ values }) {
  if (!values?.length) {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No values for this metadata yet</span>;
  }
  const visible = values.slice(0, 10);
  const extra = values.length - visible.length;
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', maxWidth: '100%' }}>
      {visible.map((v, i) => (
        <span
          key={`${v}-${i}`}
          title={v}
          style={S.valueChip}
        >
          {truncate(v, 36)}
        </span>
      ))}
      {extra > 0 && <span style={S.valueChipExtra}>+{extra}</span>}
    </div>
  );
}

function truncate(text, n) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

// ── Custom checkbox (matches design tone) ──────────────────────────────────
function Checkbox({ checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '18px', height: '18px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={onChange}
        style={{
          width: '16px', height: '16px',
          accentColor: '#a21caf',
          cursor: disabled ? 'not-allowed' : 'pointer',
          margin: 0,
        }}
      />
    </label>
  );
}

function IconBtn({ title, danger, onClick, children }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: '4px',
        marginLeft: '4px', cursor: 'pointer',
        color: danger ? '#b91c1c' : '#475569',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

// ── New / edit metadata modal ──────────────────────────────────────────────
function MetadataModal({ open, existingKeys, editing, onCancel, onSave }) {
  const isEdit = !!editing;
  const [draft, setDraft] = useState({ key: '', indexed: true, isDate: false });

  useEffect(() => {
    if (!open) return undefined;
    setDraft(editing
      ? { key: editing.key, indexed: editing.indexed, isDate: editing.isDate }
      : { key: '', indexed: true, isDate: false }
    );
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, editing, onCancel]);

  if (!open) return null;
  const keyTrim = draft.key.trim();
  const clash   = !isEdit && existingKeys.includes(keyTrim);
  const valid   = keyTrim && !clash;

  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit metadata' : 'New metadata'}
           onClick={(e) => e.stopPropagation()} style={{ ...S.modalDialog, width: 'min(480px, 100%)' }}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{isEdit ? `Edit metadata — ${editing.key}` : 'New metadata'}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FloatField label="Key" disabled={isEdit}>
            <input
              type="text"
              value={draft.key}
              disabled={isEdit}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="metadata_key"
              style={{
                ...S.formInput,
                background: isEdit ? '#f1f5f9' : '#fff',
                cursor: isEdit ? 'not-allowed' : 'text',
                fontFamily: 'monospace',
              }}
            />
          </FloatField>
          {clash && <span style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '-8px' }}>A metadata with this key already exists.</span>}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.indexed} onChange={(e) => setDraft((d) => ({ ...d, indexed: e.target.checked }))}
                   style={{ width: '16px', height: '16px', accentColor: '#a21caf', margin: 0 }} />
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>Index its values (filter / facet)</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.isDate} onChange={(e) => setDraft((d) => ({ ...d, isDate: e.target.checked }))}
                   style={{ width: '16px', height: '16px', accentColor: '#a21caf', margin: 0 }} />
            <span style={{ fontSize: '0.88rem', color: '#475569' }}>Treat as date</span>
          </label>
        </div>

        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onSave({ key: keyTrim, indexed: draft.indexed, isDate: draft.isDate })}
            style={{ ...S.primaryBtn, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatField({ label, disabled, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{
        position: 'absolute', top: '-7px', left: '10px',
        padding: '0 6px', background: '#fff',
        fontSize: '0.72rem', color: disabled ? '#cbd5e1' : '#94a3b8',
        fontWeight: 500, pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}>{label}</span>
    </div>
  );
}

function ConfirmModal({ open, title, body, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="presentation" onClick={onCancel} style={S.modalOverlay}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={S.modalDialog}>
        <header style={S.modalHeader}>
          <h2 style={S.modalTitle}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={S.modalClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div style={S.modalBody}>{body}</div>
        <div style={S.modalFooter}>
          <button type="button" style={S.linkBtn} onClick={onCancel}>Cancel</button>
          <button type="button" style={{ ...S.primaryBtn, background: '#b91c1c', borderColor: '#b91c1c' }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', gap: '14px' },
  headerRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px',
  },
  h1: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 },
  subtitle: { margin: '4px 0 0', fontSize: '0.92rem', color: '#475569' },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#a21caf', color: '#fff',
    border: '1px solid #a21caf', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px',
    background: '#fff', color: '#0f172a',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 12px',
    background: 'transparent', color: '#475569',
    border: '1px solid transparent', borderRadius: '4px',
    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  filterBar: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    padding: '12px 16px',
  },
  filterLabel: { fontSize: '0.86rem', color: '#475569', fontWeight: 500 },
  searchIcon: {
    position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
    color: '#94a3b8', display: 'inline-flex',
  },
  searchInput: {
    width: '100%', padding: '8px 12px 8px 30px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.88rem', color: '#0f172a',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  },
  resultCount: {
    marginLeft: 'auto',
    fontSize: '0.84rem', color: '#475569',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', tableLayout: 'fixed' },
  th: {
    textAlign: 'left', padding: '10px 14px',
    color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0', background: '#fff',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 14px', color: '#0f172a', verticalAlign: 'middle' },
  emptyCell: { padding: '40px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' },
  valueChip: {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: '999px',
    background: '#f1f5f9', color: '#334155',
    fontSize: '0.74rem', fontWeight: 500,
    maxWidth: '320px',
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  },
  valueChipExtra: {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: '999px',
    background: '#fdf2f8', color: '#a21caf',
    fontSize: '0.74rem', fontWeight: 600,
  },
  actionsBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
    background: '#f8fafc', borderRadius: '4px',
    position: 'sticky', bottom: 0,
  },
  formInput: {
    width: '100%', padding: '14px 12px',
    border: '1px solid #cbd5e1', borderRadius: '4px',
    background: '#fff', fontSize: '0.92rem', color: '#0f172a',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 10001,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  modalDialog: {
    width: 'min(440px, 100%)', background: '#fff',
    borderRadius: '8px', boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
  },
  modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  modalClose: {
    width: '30px', height: '30px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: '18px', color: '#0f172a', fontSize: '0.92rem', lineHeight: 1.5 },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 16px', borderTop: '1px solid #e2e8f0',
  },
};
