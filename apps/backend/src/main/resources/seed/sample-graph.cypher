CREATE (portal:Application {
  id: $portalId,
  name: 'Portail client',
  description: 'Interface web B2B'
})
CREATE (gateway:Application {
  id: $gatewayId,
  name: 'API Gateway',
  description: "Point d'entrée HTTP"
})
CREATE (orders:Application {
  id: $ordersId,
  name: 'Service commandes',
  description: 'Orchestration des commandes'
})
CREATE (customers:Application {
  id: $customersId,
  name: 'Base clients',
  description: 'Référentiel clients et comptes'
})
CREATE (payments:Application {
  id: $paymentsId,
  name: 'Paiements',
  description: 'Traitement des paiements'
})
CREATE (portal)-[:DEPENDS_ON]->(gateway)
CREATE (gateway)-[:DEPENDS_ON]->(orders)
CREATE (orders)-[:DEPENDS_ON]->(customers)
CREATE (gateway)-[:DEPENDS_ON]->(payments)
CREATE (portal)-[:DEPENDS_ON]->(customers)
CREATE (m_ui:Module {
  id: $modUiId,
  name: 'UI SPA',
  description: 'Interface utilisateur'
})
CREATE (m_api:Module {
  id: $modApiId,
  name: 'Couche API',
  description: 'Contrôleurs REST'
})
CREATE (m_pkg:Module {
  id: $modPkgId,
  name: 'Paquet domaine',
  description: 'Logique métier partagée'
})
CREATE (portal)-[:CONTAINS]->(m_ui)
CREATE (portal)-[:CONTAINS]->(m_api)
CREATE (m_ui)-[:CONTAINS]->(m_pkg)
