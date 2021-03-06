import { ApiPromise, WsProvider } from "@polkadot/api";

export async function allNominators() {
	let endpoint = "ws://localhost::9944"
	const provider = new WsProvider(endpoint);
	const api = await ApiPromise.create({ provider })

	let entries = await api.query.staking.nominators.keys()

	let stakers = []
	for (let x of entries.slice(0, 10)) {
		let k = x.toU8a().slice(-32)
		let ctrl = (await api.query.staking.bonded(k)).unwrap()
		let ledger = (await api.query.staking.ledger(ctrl)).unwrapOrDefault()
		let stake = ledger.active
		stakers.push({who: x, stake: stake})
	}
	stakers.sort((a, b) => {
		console.log(`${a.stake.toHuman()}.stake.toBn() > ${b.stake.toHuman()}.stake.toBn() = ${a.stake.toBn() > b.stake.toBn()}`)
		if (a.stake.toBn() > b.stake.toBn()) { return 1 } else if (a.stake.toBn() < b.stake.toBn()) { return -1 } else { return 0 }
	})

	stakers.forEach(({ who, stake }, _) => {
		console.log(who.toHuman(), stake.toHuman())
	})
}

export async function perbillTest() {
	let endpoint = "ws://localhost::9944"
	const provider = new WsProvider(endpoint);
	const api = await ApiPromise.create({ provider })

	const { commission } = await api.query.staking.validators("5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty")
	console.log(commission.unwrap().toHex());
	console.log(commission.unwrap().toHuman());
	console.log(commission.unwrap().toU8a());
	console.log(commission.unwrap().toJSON());
	console.log(commission.unwrap().toNumber());
	console.log(commission.unwrap().toBn());
	console.log(commission.unwrap().toString());

}

export async function latestElectionSubmissions() {
	let endpoint = "ws://localhost:9944"
	const provider = new WsProvider(endpoint);
	const api = await ApiPromise.create({ provider })

	const head = await api.rpc.chain.getFinalizedHead();
	let now = head
	console.log(`starting at ${now}`);
	let _electionStatus = await api.query.staking.eraElectionStatus.at(now);
	while (true) {
		let block = await api.rpc.chain.getBlock(now);
		let extrinsics = block.block.extrinsics;
		let events = await api.query.system.events.at(now)
		let maximum_weight = api.consts.system.maximumBlockWeight.toNumber()
		let maximum_length = api.consts.system.maximumBlockLength.toNumber()
		let electionStatus = await api.query.staking.eraElectionStatus.at(now);

		for (let ext of extrinsics) {
			if (ext.meta.name.toString().includes("submit_election_solution")) {
				let era = await api.query.staking.currentEra.at(now);
				let found = false;
				let weight = await api.query.system.blockWeight.at(now)
				for (let event of events) {
					if (event.event.meta.name.includes("SolutionStored")) {
						console.log(`✅ Found a correct ${ext.meta.name} for era ${era.toHuman()} => score ${ext.args[2]}`)
						console.log(`⌚️ Weight = ${weight} (${weight['normal'].toNumber() / maximum_weight}). Len = ${ext.encodedLength} (${ext.encodedLength / maximum_length})`)
						found = true
						break;
					}
				}
				if (!found) {
					console.log(`❌ Found a failed ${ext.meta.name} for era ${era.toHuman()} => score ${ext.args[2]}. Weight = ${weight}. Len = ${ext.encodedLength}`)
				}
			}
		}

		for (let event of events) {
			if (event.event.meta.name.includes("StakingElection")) {
				console.log(`🤑 Staking election closed at ${now} (${block.block.header.number}) with compute ${event.event.data.toHuman()}`)
				break;
			}
		}

		if (_electionStatus.isClose !== electionStatus.isClose) {
			console.log(`change in election status at ${(await api.rpc.chain.getHeader(now)).number}. previous ${_electionStatus}, now ${electionStatus}`)
			_electionStatus = electionStatus
		}

		now = block.block.header.parentHash
	}
}
