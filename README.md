# Fluido Provedor de Autenticação

Consiste num provedor de React para abstração do FirebaseAuth

## Modo de usar

### Exemplo de provedor

```tsx
import ProfileProvider from '@fluido/react-profile-manager'

function App() {
  return (
    <ProfileProvider
      firebaseApp={FirebaseApp}
      pathname={currentRoute}
      refreshTokenTime={currentRoute}
      FCMKey={FirebaseCloudMessageKey}
      onCallRedirectToPublic={function handlePathnameUnauthorized() {}}
      onCallRedirectToAuthenticated={function handlePathnameAuthorizedBlock() {}}
      unauthenticatedRoutes={['/', '/home', '/login']}
      authenticatedRoutes={['/dashboard']}>
      <YourRoutes>...</YourRoutes>
    </ProfileProvider>
  )
}
```

### Exemplo do hook

```tsx
import { useProfile } from '@fluido/react-profile-manager'

function MyComponent() {
  const { ready, logged, user, token, FCMToken, FCMState, claims } =
    userProfile()

  return <div></div>
}
```

### Especificação das propriedades do provedor

| Parâmetro                     | `default`    | Tipo          | Descrição                                                                                         |
| ----------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------- |
| firebaseApp                   | `undefined`  | `FirebaseApp` | aplicativo firebase inicializado                                                                  |
| refreshTokenTime              | `20`         | `number`      | tempo em segundos que o token será atualizado                                                     |
| pathname                      | `undefined`  | `string`      | caminho URL para comparação das rotas autenticadas e não autenticadas                             |
| FCMKey                        | `undefined`  | `string`      | chave para o Firebase Cloud Message                                                               |
| onCallRedirectToPublic        | `undefined`  | `() => {}`    | função é chamada quando _pathname_ está incluso na lista _authenticatedRoutes_                    |
| onCallRedirectToAuthenticated | `undefined`  | `() => {}`    | função é chamada quando _pathname_ está incluso na lista _unauthenticatedRoutes_                  |
| unauthenticatedRoutes         | `['/login']` | `string[]`    | lista de caminhos que chama a função _onCallRedirectToAuthenticated_ com o usuário já autenticado |
| authenticatedRoutes           | `[]`         | `string[]`    | lista de caminhos que chama a função _onCallRedirectToPublic_ sem usuário autenticado             |

### Especificação das propriedades do hook

| Parâmetro | Tipo                                           | Descrição                                                  |
| --------- | ---------------------------------------------- | ---------------------------------------------------------- |
| ready     | `boolean`                                      | `true` se o _FirebaseAuth_ já carregou os dados do usuário |
| logged    | `boolean`                                      | `true` se o usuário está autenticado                       |
| user      | `FirebaseUser`                                 | dados do usuário autenticado                               |
| token     | `string`                                       | _token_ de acesso do usuário                               |
| FCMToken  | `string`                                       | _token_ identificador do FCM Z                             |
| FCMState  | `'loading' \| 'ready' \| 'require' \| 'error'` | estado em que se encontra o FCM                            |
| claims    | `string \| string[]`                           | dados do usuário armazenado no _FirebaseFirestore_         |
