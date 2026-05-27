CREATE (portal:Application {
  id: $portalId,
  name: 'Portail client',
  description: 'Interface web B2B',
  validFrom: $vf,
  validTo: null
})
CREATE (gateway:Application {
  id: $gatewayId,
  name: 'API Gateway',
  description: "Point d'entrée HTTP",
  validFrom: $vf,
  validTo: null
})
CREATE (orders:Application {
  id: $ordersId,
  name: 'Service commandes',
  description: 'Orchestration des commandes',
  validFrom: $vf,
  validTo: null
})
CREATE (customers:Application {
  id: $customersId,
  name: 'Base clients',
  description: 'Référentiel clients et comptes',
  validFrom: $vf,
  validTo: null
})
CREATE (payments:Application {
  id: $paymentsId,
  name: 'Paiements',
  description: 'Traitement des paiements',
  validFrom: $vf,
  validTo: null
})
CREATE (portal)-[:DEPENDS_ON { validFrom: $vf, validTo: null }]->(gateway)
CREATE (gateway)-[:DEPENDS_ON { validFrom: $vf, validTo: null }]->(orders)
CREATE (orders)-[:DEPENDS_ON { validFrom: $vf, validTo: null }]->(customers)
CREATE (gateway)-[:DEPENDS_ON { validFrom: $vf, validTo: null }]->(payments)
CREATE (portal)-[:DEPENDS_ON { validFrom: $vf, validTo: null }]->(customers)
CREATE (m_ui:Module {
  id: $modUiId,
  name: 'UI SPA',
  description: 'Interface utilisateur',
  validFrom: $vf,
  validTo: null
})
CREATE (m_api:Module {
  id: $modApiId,
  name: 'Couche API',
  description: 'Contrôleurs REST',
  validFrom: $vf,
  validTo: null
})
CREATE (m_pkg:Module {
  id: $modPkgId,
  name: 'Paquet domaine',
  description: 'Logique métier partagée',
  validFrom: $vf,
  validTo: null
})
CREATE (portal)-[:CONTAINS { validFrom: $vf, validTo: null }]->(m_ui)
CREATE (portal)-[:CONTAINS { validFrom: $vf, validTo: null }]->(m_api)
CREATE (m_ui)-[:CONTAINS { validFrom: $vf, validTo: null }]->(m_pkg)
CREATE (bu_retail:BusinessUnit {
  id: $buRetailId,
  name: 'Retail & expérience client',
  code: 'RETAIL',
  description: 'Parcours front-office'
})
CREATE (bu_platform:BusinessUnit {
  id: $buPlatformId,
  name: 'Plateforme & paiements',
  code: 'PLAT',
  description: 'Services transverses'
})
CREATE (bu_retail)-[:HAS_APPLICATION]->(portal)
CREATE (bu_retail)-[:HAS_APPLICATION]->(gateway)
CREATE (bu_retail)-[:HAS_APPLICATION]->(customers)
CREATE (bu_platform)-[:HAS_APPLICATION]->(orders)
CREATE (bu_platform)-[:HAS_APPLICATION]->(payments)
CREATE (reg_emea:Region {
  id: $regionEmeaId,
  code: 'EMEA',
  name: 'Europe, Middle East & Africa',
  description: 'Région EMEA'
})
CREATE (reg_apac:Region {
  id: $regionApacId,
  code: 'APAC',
  name: 'Asia-Pacific',
  description: 'Région APAC'
})
CREATE (reg_americas:Region {
  id: $regionAmericasId,
  code: 'AMERICAS',
  name: 'Americas',
  description: 'Région Amériques'
})
CREATE (portal)-[:IS_USED_IN]->(reg_emea)
CREATE (portal)-[:IS_USED_IN]->(reg_apac)
CREATE (gateway)-[:IS_USED_IN]->(reg_emea)
CREATE (orders)-[:IS_USED_IN]->(reg_apac)
CREATE (customers)-[:IS_USED_IN]->(reg_emea)
CREATE (payments)-[:IS_USED_IN]->(reg_americas)
CREATE (alice:Contributor {
  id: $contribAliceId,
  firstName: 'Alice',
  lastName: 'Dupont',
  team: 'Checkout'
})
CREATE (bob:Contributor {
  id: $contribBobId,
  firstName: 'Bob',
  lastName: 'Martin',
  team: 'Paiements'
})
CREATE (alice)-[:WORK_IN]->(bu_retail)
CREATE (bob)-[:WORK_IN]->(bu_platform)
CREATE (alice)-[:WORK_ON]->(portal)
CREATE (alice)-[:WORK_ON]->(gateway)
CREATE (bob)-[:WORK_ON]->(orders)
CREATE (alice)-[:REPORTS_TO]->(bob)
