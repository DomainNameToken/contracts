# Order data contents / format

All orders must provide order information in JSON format ( pgp encrypted )

## Common properties
All order types must provide `domainName` - required for all order types
```json
{ "domainName": "example.com" }
```
Extra information can be attached to each order through an `extra` property. Optional.

```json
{ "domainName": "example.com", "extra": ... }
```

## Registration order format

```json
{ "domainName": "example.com", "years": 1 }
```

## Extend order format

```json
{ "domainName": "example.com", "years": 3 }
```

## Import order format

```json
{ "domainName": "example.com", "transferCode": "authorizationCode from current registrar" }
```


<span style="color:red; font-size: 64">IMPORTANT!!!</span>

The JSON should be encrypted when sent to the blockchain acquisition manager contract


