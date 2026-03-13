#!/bin/bash

IDENTIFIER="${1:-FSD-13}"

echo "Checking for issue: $IDENTIFIER"
echo ""

docker exec -i $(docker ps -q -f name=postgres) psql -U Jigong -d Jigong << EOF
SELECT 
  id,
  identifier,
  title,
  status,
  company_id,
  created_at
FROM issues
WHERE identifier = '$IDENTIFIER';

\echo ''
\echo 'Sample issues in database:'
SELECT identifier, title FROM issues LIMIT 10;
EOF
