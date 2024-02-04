import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Token22Staking } from "../target/types/token22_staking";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, mintTo, createMint, setAuthority, AuthorityType, getAssociatedTokenAddress, createAssociatedTokenAccount, getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { delay, safeAirdrop } from './utils/utils'

describe("token22-staking", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Token22Staking as Program<Token22Staking>;
  const provider = anchor.AnchorProvider.env()

  const payer = anchor.web3.Keypair.generate()

  let stakingTokenMint: PublicKey = null
  let stakeVault: PublicKey = null
  let pool: PublicKey = null
  let testTokenMint: PublicKey = null
  let user1StakeEntry: PublicKey = null
  let user2StakeEntry: PublicKey = null
  let user3StakeEntry: PublicKey = null


  // derive program authority PDA
  let [vaultAuthority, vaultAuthBump] = await PublicKey.findProgramAddress(
    [Buffer.from("vault_authority")],
    program.programId
  )


  it("Create Staking Token Mint", async () => {
    await safeAirdrop(vaultAuthority, provider.connection)
    await safeAirdrop(provider.wallet.publicKey, provider.connection)
    await safeAirdrop(payer.publicKey, provider.connection)
    delay(10000)

    // create staking token mint    
    stakingTokenMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      undefined,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
    
    console.log("Staking token mint: ", stakingTokenMint.toBase58())

    // assign staking token mint to a PDA of the staking program
    let setAuthTx = await setAuthority(
      provider.connection,
      payer,
      stakingTokenMint,
      payer,
      AuthorityType.MintTokens,
      vaultAuthority,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
    
    console.log("Authority assignment tx: ", setAuthTx)
  })

  it("Create test token to stake", async () => {
    // create new token mint    
    testTokenMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      undefined,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    console.log("Test token mint: ", testTokenMint.toBase58())

    // create associated token account of test user
    let ata = await createAssociatedTokenAccount (
      provider.connection,
      payer,
      testTokenMint,
      payer.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    console.log("Test user associated tokena account: ", ata.toBase58())

    // mint 1000 tokens to test user
    let mintTx = await mintTo(
      provider.connection,
      payer,
      testTokenMint,
      ata,
      payer,
      1000,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
    
    console.log("Mint tx: ", mintTx)
  })

  it("Create test stake pool!", async () => {
    const [poolState, poolBump] = await PublicKey.findProgramAddress(
      [testTokenMint.toBuffer(), Buffer.from("state")],
      program.programId
    )
    pool = poolState

    const [vault, vaultBump] = await PublicKey.findProgramAddress(
      [testTokenMint.toBuffer(), vaultAuthority.toBuffer(), Buffer.from("vault")],
      program.programId
    )
    stakeVault = vault

    // call init_pool ix on program
    await program.methods.initPool()
    .accounts({
      poolAuthority: vaultAuthority,
      poolState: pool,
      tokenMint: testTokenMint,
      tokenVault: vault,
      stakingTokenMint: stakingTokenMint,
      payer: payer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([payer])
    .rpc()
  })

  it("Create stake entry for user", async () => {
    const poolStateAcct = await program.account.poolState.fetch(pool)
    
    const [stakeEntry, stakeentryBump] = await PublicKey.findProgramAddress(
      [payer.publicKey.toBuffer(), poolStateAcct.tokenMint.toBuffer(), Buffer.from("stake_entry")],
      program.programId
    )
    user1StakeEntry = stakeEntry

    await program.methods.initStakeEntry()
    .accounts({
      user: payer.publicKey,
      userStakeEntry: user1StakeEntry,
      poolState: pool,
      systemProgram: SystemProgram.programId
    })
    .signers([payer])
    .rpc()
  })

  // it("Is initialized!", async () => {
  //   // Add your test here.
  //   const tx = await program.methods.initialize().rpc();
  //   console.log("Your transaction signature", tx);
  // });
});
