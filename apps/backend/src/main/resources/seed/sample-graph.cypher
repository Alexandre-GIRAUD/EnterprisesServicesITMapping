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
