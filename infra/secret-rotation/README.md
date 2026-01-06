# Secret Rotation Sync Lambda

This folder contains a small Lambda function (`lambda_secret_sync.py`) that keeps the
custom Secrets Manager secret (`jiraibrary-prod-database-url-5hcnsp`) aligned with
the automatically rotated AWS-managed RDS secret (`rds!db-*`). The Lambda is meant to
run on a schedule so that App Runner always reads the latest password by continuing to
reference the custom secret ARN.

## Lambda responsibilities

1. Read both secrets via Secrets Manager.
2. Detect whether the rotated password differs from the password stored in the custom
   secret.
3. Rebuild the `postgres://` connection string (matching the format Django expects) and
   update the custom secret payload when a change occurs.
4. Exit without changes when the password is already up to date so the function is
   safe to run frequently.

### Environment variables

Set the following Lambda environment variables:

| Name | Purpose |
| --- | --- |
| `RDS_SECRET_ARN` | ARN of the AWS-managed rotation secret (the one that starts with `rds!db-`). |
| `CUSTOM_SECRET_ARN` | ARN of the custom secret that App Runner references. |
| `DB_NAME` / `DB_HOST` / `DB_PORT` / `DB_USERNAME` | Optional fallbacks if a value is missing from either secret. |
| `PG_SSLMODE` | Appended to the connection string query parameters (defaults to `require`). |

The Lambda execution role needs `secretsmanager:GetSecretValue` on both secrets and
`secretsmanager:PutSecretValue` on the custom secret.

## Deploying / updating the Lambda code

```powershell
cd infra/secret-rotation
Compress-Archive -Path lambda_secret_sync.py -DestinationPath secret_sync.zip -Force
aws lambda update-function-code `
  --function-name update-app-runner-database-url `
  --zip-file fileb://secret_sync.zip
```

> Replace `update-app-runner-database-url` with the actual Lambda function name.

## EventBridge schedule

Automatic rotation occurs every seven days, so schedule the Lambda to run at least
daily (twice per day is even safer). For quick verification you can temporarily run
it every five minutes as shown below, then relax the cadence afterward. Example
infrastructure-as-code snippet (CloudFormation/SAM):

```yaml
Resources:
  SecretSyncRule:
    Type: AWS::Events::Rule
    Properties:
      Description: Invoke the secret sync Lambda every 5 minutes.
      ScheduleExpression: rate(5 minutes)
      State: ENABLED
      Targets:
        - Arn: !GetAtt SecretSyncLambda.Arn
          Id: SecretSyncTarget
  SecretSyncPermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref SecretSyncLambda
      Principal: events.amazonaws.com
      SourceArn: !GetAtt SecretSyncRule.Arn
```

If you prefer the AWS CLI:

```powershell
aws events put-rule `
  --name secret-sync-schedule `
  --schedule-expression "rate(5 minutes)" `
  --description "Invoke update-app-runner-database-url Lambda every 5 minutes"

aws lambda add-permission `
  --function-name update-app-runner-database-url `
  --statement-id secret-sync-schedule `
  --action lambda:InvokeFunction `
  --principal events.amazonaws.com `
  --source-arn arn:aws:events:us-east-2:789924422625:rule/secret-sync-schedule

aws events put-targets `
  --rule secret-sync-schedule `
  --targets Id="SecretSync",Arn="arn:aws:lambda:us-east-2:789924422625:function:update-app-runner-database-url"
```

## Testing

After deploying the updated Lambda:

1. Trigger the function manually from the Lambda console to ensure it can read both
   secrets and update the custom secret.
2. Examine the custom secret's version list—after the first rotation run you should
   see a new version with the rebuilt `DATABASE_URL`.
3. Wait for the next automatic RDS rotation. CloudWatch logs for the scheduled runs
   should show the `action: updated` message whenever the password changes.
