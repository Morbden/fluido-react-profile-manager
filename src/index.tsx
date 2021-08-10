import { useLayoutEffect, useContext, createContext, useState } from 'react'
import firebase from 'firebase'

type FCMTokenStateType = 'loading' | 'error' | 'required' | 'ready'

interface TypedMap<T = any> {
  [key: string]: T
}

export interface ProfileProps {
  ready: boolean
  logged: boolean
  user: firebase.User | null
  token: string | null
  FCMToken: string | null
  FCMState: FCMTokenStateType | null
  claims: TypedMap<string | string[]>
}

export interface ProfileManagerProps {
  firebaseApp: firebase.app.App
  dbUse?: 'firestore' | 'database'
  pathname?: string
  FCMKey?: string
  onCallRedirectToPublic?: VoidFunction
  onCallRedirectToAuthenticated?: VoidFunction
  unauthenticatedRoutes?: string[]
  authenticatedRoutes?: string[]
}

const ProfileContext = createContext<ProfileProps>({
  ready: false,
  logged: false,
  user: null,
  token: null,
  FCMToken: null,
  FCMState: null,
  claims: {},
})

export const useProfile = () => useContext(ProfileContext)

export default function ProfileProvider({
  children,
  firebaseApp,
  dbUse = 'database',
  pathname,
  FCMKey,
  onCallRedirectToPublic,
  onCallRedirectToAuthenticated,
  unauthenticatedRoutes = ['/login'],
  authenticatedRoutes = [],
}: React.PropsWithChildren<ProfileManagerProps>) {
  // Profile Provider
  const [ready, setReady] = useState<boolean>(false)
  const [user, setUser] = useState<firebase.User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [FCMToken, setFCMToken] = useState<string | null>(null)
  const [FCMState, setFCMState] = useState<FCMTokenStateType | null>()
  const [claims, setClaims] = useState<TypedMap<string | string[]>>()

  if (dbUse === 'database') {
    useLayoutEffect(() => {
      let metaRef: firebase.database.Reference
      let claimsRef: firebase.database.Reference
      let callback: VoidFunction = null
      const unregister = firebaseApp.auth().onAuthStateChanged((user) => {
        if (metaRef) {
          metaRef.off()
          metaRef = null
          callback = null
        }

        if (claimsRef) {
          claimsRef.off()
          claimsRef = null
        }

        setUser(user)

        if (user) {
          callback = () => {
            user.getIdToken(true).then((token) => {
              setToken(token)
            })
          }

          metaRef = firebaseApp
            .database()
            .ref(`users/${user.uid}/claims-refresh`)
          metaRef.on('value', callback)

          claimsRef = firebaseApp.database().ref(`users/${user.uid}/claims`)
          claimsRef.on('value', (snapshot) => {
            setReady(true)
            if (snapshot.exists()) {
              setClaims(snapshot.val())
            } else {
              setClaims({})
            }
          })
        } else {
          setReady(true)
          setToken(null)
        }
      })

      return () => {
        unregister()
        metaRef && metaRef.off()
        claimsRef && claimsRef.off()
      }
    }, [dbUse])
  } else if (dbUse === 'firestore') {
    useLayoutEffect(() => {
      let unregisterSnaps: VoidFunction[] = []
      const unregister = firebaseApp.auth().onAuthStateChanged((user) => {
        unregisterSnaps.forEach((e) => e())
        unregisterSnaps = []

        setUser(user)

        if (user) {
          const userRef = firebase.firestore().doc(`users/${user.uid}`)
          const claimsRef = userRef.collection(`claims`)

          unregisterSnaps.push(
            claimsRef.onSnapshot((snapshot) => {
              setReady(true)
              user.getIdToken(true).then((token) => {
                setToken(token)
              })
              if (!snapshot.empty) {
                setClaims(
                  snapshot.docs.reduce((prev, doc) => {
                    return { ...prev, [doc.id]: Object.values(doc.data()) }
                  }, {}),
                )
              } else {
                setClaims({})
              }
            }),
          )
        } else {
          setReady(true)
          setToken(null)
        }
      })

      return () => {
        unregister()
        unregisterSnaps.forEach((e) => e())
      }
    }, [dbUse])
  }

  // Page blocker
  useLayoutEffect(() => {
    if (!ready) return

    if (!user && authenticatedRoutes.includes(pathname)) {
      onCallRedirectToPublic && onCallRedirectToPublic()
    } else if (!!user && unauthenticatedRoutes.includes(pathname)) {
      onCallRedirectToAuthenticated && onCallRedirectToAuthenticated()
    }
  }, [ready, !!user, pathname])

  // FCM Loader
  useLayoutEffect(() => {
    if (!FCMKey) return

    setFCMState('loading')
    setFCMToken(null)
    try {
      const messaging = firebaseApp.messaging()
      messaging
        .getToken({ vapidKey: FCMKey })
        .then(async (token) => {
          if (token) {
            setFCMToken(token)
            setFCMState('ready')
          } else {
            setFCMState('required')
          }
        })
        .catch((err: Error) => {
          if (err.message.includes('permission-blocked')) {
            setFCMState('required')
          } else {
            console.log(err)
          }
          setFCMState('error')
        })
    } catch (err) {
      setFCMState('error')
    }
  }, [FCMKey])

  useLayoutEffect(() => {
    if (ready && !!user && FCMToken && FCMState === 'ready') {
      firebaseApp.database().ref(`users/${user.uid}/fcm`).set(FCMToken)
    }
  }, [ready, !!user, FCMToken, FCMState])

  return (
    <ProfileContext.Provider
      value={{
        user,
        logged: !!user,
        claims,
        ready,
        token,
        FCMToken,
        FCMState,
      }}>
      {children}
    </ProfileContext.Provider>
  )
}
