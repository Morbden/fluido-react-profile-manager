import { FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import { getMessaging, getToken } from 'firebase/messaging'
import { createContext, useContext, useLayoutEffect, useState } from 'react'

type FCMTokenStateType = 'loading' | 'error' | 'required' | 'ready'

interface TypedMap<T = any> {
  [key: string]: T
}

export interface ProfileProps {
  ready: boolean
  logged: boolean
  user: User | null
  token: string | null
  FCMToken: string | null
  FCMState: FCMTokenStateType | null
  claims: TypedMap<string | string[]>
}

export interface ProfileManagerProps {
  firebaseApp: FirebaseApp
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
  pathname,
  FCMKey,
  onCallRedirectToPublic,
  onCallRedirectToAuthenticated,
  unauthenticatedRoutes = ['/login'],
  authenticatedRoutes = [],
}: React.PropsWithChildren<ProfileManagerProps>) {
  // Profile Provider
  const [ready, setReady] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [FCMToken, setFCMToken] = useState<string | null>(null)
  const [FCMState, setFCMState] = useState<FCMTokenStateType | null>()
  const [claims, setClaims] = useState<TypedMap<string | string[]>>()

  useLayoutEffect(() => {
    let unregisterSnaps: VoidFunction[] = []
    const auth = getAuth(firebaseApp)
    const unregister = onAuthStateChanged(auth, (user) => {
      unregisterSnaps.forEach((e) => e())
      unregisterSnaps = []

      setUser(user)

      if (user) {
        const db = getFirestore(firebaseApp)
        const userRef = doc(db, `users/${user.uid}`)
        const claimsRef = collection(userRef, `claims`)

        unregisterSnaps.push(
          onSnapshot(claimsRef, (snapshot) => {
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
  }, [])

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
      const messaging = getMessaging(firebaseApp)
      getToken(messaging, { vapidKey: FCMKey })
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
      const db = getFirestore()
      const userDoc = doc(db, `users/${user.uid}`)
      setDoc(userDoc, { fcm: FCMToken }, { merge: true })
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
