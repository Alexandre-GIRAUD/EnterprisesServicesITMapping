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
