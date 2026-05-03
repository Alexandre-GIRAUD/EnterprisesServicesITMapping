MATCH (a:Application)-[r:DEPENDS_ON|CONTAINS]->(b:Application)
RETURN
  a.id   AS sourceId,
  a.name AS sourceName,
  type(r) AS relationType,
  r.id AS edgeId,
  r.validFrom AS validFrom,
  r.validTo AS validTo,
  b.id   AS targetId,
  b.name AS targetName
ORDER BY relationType, sourceName, targetName